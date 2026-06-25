import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLyricsFetchQueue, CONCURRENCY } from './lyricsFetchQueue.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockResp(data, ok = true) {
  return { ok, json: () => Promise.resolve(data) };
}

// Flush enough microtask rounds to let a resolved deferred propagate through
// fetch → json() → onTrackResult → .finally → tryNext.
async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

describe('CONCURRENCY', () => {
  it('is 6', () => {
    expect(CONCURRENCY).toBe(6);
  });
});

describe('runLyricsFetchQueue', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves immediately when itemIds is empty', async () => {
    await expect(
      runLyricsFetchQueue({
        albumId: 1,
        itemIds: [],
        onProgress: vi.fn(),
        onTrackResult: vi.fn(),
      })
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts at most CONCURRENCY requests simultaneously', async () => {
    const defs = Array.from({ length: 8 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const queuePromise = runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1, 2, 3, 4, 5, 6, 7, 8],
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    // tryNext runs synchronously in the Promise executor, so all 6 slots fill
    // before the first await tick.
    expect(fetchMock).toHaveBeenCalledTimes(6);

    // Resolve one → 7th should start once microtasks settle.
    defs[0].resolve(mockResp({ found: false }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(7);

    // Resolve another → 8th starts.
    defs[1].resolve(mockResp({ found: false }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(8);

    // Drain the rest.
    for (let i = 2; i < 8; i++) defs[i].resolve(mockResp({ found: false }));
    await queuePromise;
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('normalises snake_case response fields to camelCase', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResp({
        found: true,
        new_lyrics: 'lyrics text',
        new_synced: true,
        new_backend: 'genius',
        current_lyrics: 'old lyrics',
        current_source: 'embedded',
      })
    );

    const results = [];
    await runLyricsFetchQueue({
      albumId: 1,
      itemIds: [42],
      onProgress: vi.fn(),
      onTrackResult: (r) => results.push(r),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      itemId: 42,
      found: true,
      newLyrics: 'lyrics text',
      newSynced: true,
      newBackend: 'genius',
      currentLyrics: 'old lyrics',
      currentSource: 'embedded',
    });
  });

  it('normalises a miss response (found: false) including current fields', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResp({
        found: false,
        current_lyrics: 'existing lyrics',
        current_source: 'embedded',
      })
    );

    const results = [];
    await runLyricsFetchQueue({
      albumId: 1,
      itemIds: [7],
      onProgress: vi.fn(),
      onTrackResult: (r) => results.push(r),
    });

    expect(results[0]).toMatchObject({
      itemId: 7,
      found: false,
      currentLyrics: 'existing lyrics',
      currentSource: 'embedded',
      newLyrics: null,
    });
  });

  it('progress aggregates to total across all tracks', async () => {
    const defs = [deferred(), deferred(), deferred()];
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const progressEvents = [];
    const queuePromise = runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      onProgress: (done, total) => progressEvents.push({ done, total }),
      onTrackResult: vi.fn(),
    });

    defs[0].resolve(mockResp({ found: false }));
    defs[1].resolve(mockResp({ found: true }));
    defs[2].resolve(mockResp({ found: false }));
    await queuePromise;

    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[progressEvents.length - 1]).toEqual({
      done: 3,
      total: 3,
    });
    // done is monotonically increasing
    expect(progressEvents.map((e) => e.done)).toEqual([1, 2, 3]);
  });

  it('isolates one track error — queue keeps going, onTrackResult receives error status', async () => {
    const defs = [deferred(), deferred(), deferred()];
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const results = [];
    const progressEvents = [];
    const queuePromise = runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      onProgress: (done, total) => progressEvents.push({ done, total }),
      onTrackResult: (r) => results.push(r),
    });

    // Track 1 fails with a network error.
    defs[0].reject(new TypeError('Network error'));
    defs[1].resolve(
      mockResp({ found: true, new_lyrics: 'hi', current_lyrics: '' })
    );
    defs[2].resolve(
      mockResp({
        found: false,
        current_lyrics: 'old',
        current_source: 'embedded',
      })
    );
    await queuePromise;

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ itemId: 1, status: 'error' });
    expect(results[1]).toMatchObject({ itemId: 2, found: true });
    expect(results[2]).toMatchObject({
      itemId: 3,
      found: false,
      currentLyrics: 'old',
    });
    // Progress still reaches total.
    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[2].done).toBe(3);
  });

  it('reports error status for a non-ok HTTP response', async () => {
    fetchMock.mockResolvedValueOnce(mockResp({}, false));

    const results = [];
    await runLyricsFetchQueue({
      albumId: 1,
      itemIds: [9],
      onProgress: vi.fn(),
      onTrackResult: (r) => results.push(r),
    });

    expect(results[0]).toMatchObject({
      itemId: 9,
      status: 'error',
      found: false,
    });
  });

  it('aborting stops further requests and does not report progress', async () => {
    const controller = new AbortController();
    const defs = Array.from({ length: 4 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const onProgress = vi.fn();
    const onTrackResult = vi.fn();

    const queuePromise = runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1, 2, 3, 4],
      signal: controller.signal,
      onProgress,
      onTrackResult,
      concurrency: 2,
    });

    // Only 2 in-flight with concurrency=2.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    controller.abort();
    // Reject in-flight requests as a real fetch would on abort.
    defs[0].reject(new DOMException('Aborted', 'AbortError'));
    defs[1].reject(new DOMException('Aborted', 'AbortError'));

    await queuePromise;

    // No additional fetches were started.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // No progress or results reported for aborted requests.
    expect(onProgress).not.toHaveBeenCalled();
    expect(onTrackResult).not.toHaveBeenCalled();
  });

  it('aborting before first tick starts no requests', async () => {
    const controller = new AbortController();
    controller.abort();

    fetchMock.mockResolvedValue(mockResp({ found: false }));

    await runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      signal: controller.signal,
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses POST method and the correct URL for each track', async () => {
    fetchMock.mockResolvedValue(mockResp({ found: false }));

    await runLyricsFetchQueue({
      albumId: 5,
      itemIds: [11, 22],
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/album/5/track/11/lyrics/fetch',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/album/5/track/22/lyrics/fetch',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('passes the AbortSignal to each fetch call', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(mockResp({ found: false }));

    await runLyricsFetchQueue({
      albumId: 1,
      itemIds: [1],
      signal: controller.signal,
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
