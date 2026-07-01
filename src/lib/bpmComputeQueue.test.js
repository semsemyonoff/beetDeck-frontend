import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBpmComputeQueue, CONCURRENCY } from './bpmComputeQueue.js';

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

async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

describe('CONCURRENCY', () => {
  it('is 2', () => {
    expect(CONCURRENCY).toBe(2);
  });
});

describe('runBpmComputeQueue', () => {
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
      runBpmComputeQueue({
        albumId: 1,
        itemIds: [],
        onTrackStart: vi.fn(),
        onProgress: vi.fn(),
        onTrackResult: vi.fn(),
      })
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts at most CONCURRENCY requests simultaneously', async () => {
    const defs = Array.from({ length: 5 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3, 4, 5],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    defs[0].resolve(mockResp({ bpm: 120 }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    defs[1].resolve(mockResp({ bpm: 130 }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    for (let i = 2; i < 5; i++) defs[i].resolve(mockResp({ bpm: 100 }));
    await queuePromise;
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('calls onTrackStart before the fetch for each track', async () => {
    const order = [];
    fetchMock.mockImplementation((url) => {
      order.push(`fetch:${url}`);
      return Promise.resolve(mockResp({ bpm: 100 }));
    });

    const onTrackStart = vi.fn((id) => order.push(`start:${id}`));

    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [7, 8],
      onTrackStart,
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
      concurrency: 1,
    });

    // With concurrency=1, start:7 must precede fetch for 7, and start:8 before fetch for 8.
    const start7 = order.indexOf('start:7');
    const fetch7 = order.findIndex((e) => e.includes('/track/7/'));
    const start8 = order.indexOf('start:8');
    const fetch8 = order.findIndex((e) => e.includes('/track/8/'));
    expect(start7).toBeLessThan(fetch7);
    expect(start8).toBeLessThan(fetch8);
  });

  it('fires onTrackResult with {bpm} on success', async () => {
    fetchMock.mockResolvedValueOnce(mockResp({ bpm: 172 }));

    const results = [];
    await runBpmComputeQueue({
      albumId: 3,
      itemIds: [42],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: (id, result) => results.push({ id, result }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: 42, result: { bpm: 172 } });
  });

  it('fires onTrackResult with {error: true} on non-ok HTTP response', async () => {
    fetchMock.mockResolvedValueOnce(mockResp({}, false));

    const results = [];
    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [9],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: (id, result) => results.push({ id, result }),
    });

    expect(results[0]).toEqual({ id: 9, result: { error: true } });
  });

  it('fires onTrackResult with {error: true} on network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network error'));

    const results = [];
    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [5],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: (id, result) => results.push({ id, result }),
    });

    expect(results[0]).toEqual({ id: 5, result: { error: true } });
  });

  it('progress aggregates to total across all tracks', async () => {
    const defs = [deferred(), deferred(), deferred()];
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const progressEvents = [];
    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      onTrackStart: vi.fn(),
      onProgress: (done, total) => progressEvents.push({ done, total }),
      onTrackResult: vi.fn(),
    });

    defs[0].resolve(mockResp({ bpm: 90 }));
    defs[1].resolve(mockResp({ bpm: 100 }));
    defs[2].resolve(mockResp({ bpm: 110 }));
    await queuePromise;

    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[progressEvents.length - 1]).toEqual({
      done: 3,
      total: 3,
    });
    expect(progressEvents.map((e) => e.done)).toEqual([1, 2, 3]);
  });

  it('one track error does not stop the queue', async () => {
    const defs = [deferred(), deferred(), deferred()];
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const results = [];
    const progressEvents = [];
    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      onTrackStart: vi.fn(),
      onProgress: (done, total) => progressEvents.push({ done, total }),
      onTrackResult: (id, result) => results.push({ id, result }),
      concurrency: 1,
    });

    defs[0].reject(new TypeError('Network error'));
    await flush();
    defs[1].resolve(mockResp({ bpm: 120 }));
    await flush();
    defs[2].resolve(mockResp({ bpm: 130 }));
    await queuePromise;

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ id: 1, result: { error: true } });
    expect(results[1]).toEqual({ id: 2, result: { bpm: 120 } });
    expect(results[2]).toEqual({ id: 3, result: { bpm: 130 } });
    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[2].done).toBe(3);
  });

  it('aborting stops dequeuing pending tracks', async () => {
    const controller = new AbortController();
    const defs = Array.from({ length: 4 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const onTrackStart = vi.fn();
    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3, 4],
      signal: controller.signal,
      onTrackStart,
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
      concurrency: 2,
    });

    // Only 2 in-flight with concurrency=2.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onTrackStart).toHaveBeenCalledTimes(2);

    controller.abort();
    // In-flight requests resolve normally (signal not forwarded to fetch).
    defs[0].resolve(mockResp({ bpm: 100 }));
    defs[1].resolve(mockResp({ bpm: 110 }));

    await queuePromise;

    // No additional fetches started for the pending tracks.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onTrackStart).toHaveBeenCalledTimes(2);
  });

  it('in-flight requests complete and report results even after abort', async () => {
    const controller = new AbortController();
    const defs = Array.from({ length: 4 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const onProgress = vi.fn();
    const onTrackResult = vi.fn();

    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3, 4],
      signal: controller.signal,
      onTrackStart: vi.fn(),
      onProgress,
      onTrackResult,
      concurrency: 2,
    });

    controller.abort();
    defs[0].resolve(mockResp({ bpm: 120 }));
    defs[1].resolve(mockResp({ bpm: 130 }));

    await queuePromise;

    // Unlike the lyrics queue, BPM in-flight requests report results — they've
    // written to disk and the UI should reflect their outcome (stale-update
    // guard is the page's responsibility, not the queue's).
    expect(onTrackResult).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('aborting before first tick starts no requests', async () => {
    const controller = new AbortController();
    controller.abort();

    fetchMock.mockResolvedValue(mockResp({ bpm: 100 }));

    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      signal: controller.signal,
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses POST method and the correct URL for each track', async () => {
    fetchMock.mockResolvedValue(mockResp({ bpm: 100 }));

    await runBpmComputeQueue({
      albumId: 5,
      itemIds: [11, 22],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/album/5/track/11/bpm/compute',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/album/5/track/22/bpm/compute',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does NOT pass AbortSignal to fetch (writes must not be interrupted)', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(mockResp({ bpm: 100 }));

    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [1],
      signal: controller.signal,
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    const fetchOptions = fetchMock.mock.calls[0][1];
    expect(fetchOptions).not.toHaveProperty('signal');
  });

  it('an errored fetch frees its pool slot so queued tracks still run', async () => {
    const defs = Array.from({ length: 3 }, () => deferred());
    let callIdx = 0;
    fetchMock.mockImplementation(() => defs[callIdx++].promise);

    const results = [];
    const queuePromise = runBpmComputeQueue({
      albumId: 1,
      itemIds: [1, 2, 3],
      onTrackStart: vi.fn(),
      onProgress: vi.fn(),
      onTrackResult: (id, result) => results.push({ id, result }),
      concurrency: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    defs[0].reject(new TypeError('Network error'));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    defs[1].resolve(mockResp({ bpm: 100 }));
    defs[2].resolve(mockResp({ bpm: 110 }));
    await queuePromise;

    expect(results).toHaveLength(3);
    expect(results.find((r) => r.id === 1)).toEqual({
      id: 1,
      result: { error: true },
    });
    expect(results.find((r) => r.id === 3)).toBeDefined();
  });

  it('onTrackStart is called for every track that starts', async () => {
    fetchMock.mockResolvedValue(mockResp({ bpm: 120 }));

    const started = [];
    await runBpmComputeQueue({
      albumId: 1,
      itemIds: [10, 20, 30],
      onTrackStart: (id) => started.push(id),
      onProgress: vi.fn(),
      onTrackResult: vi.fn(),
    });

    expect(started).toEqual(expect.arrayContaining([10, 20, 30]));
    expect(started).toHaveLength(3);
  });
});
