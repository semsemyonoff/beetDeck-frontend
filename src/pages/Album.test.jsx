import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  within,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import Album from './Album.jsx';

vi.mock('../lib/lyricsFetchQueue.js', () => ({
  CONCURRENCY: 6,
  runLyricsFetchQueue: vi.fn(),
}));
import { runLyricsFetchQueue } from '../lib/lyricsFetchQueue.js';

vi.mock('../lib/bpmComputeQueue.js', () => ({
  CONCURRENCY: 2,
  runBpmComputeQueue: vi.fn(),
}));
import { runBpmComputeQueue } from '../lib/bpmComputeQueue.js';

const origLocation = Object.getOwnPropertyDescriptor(window, 'location');

function stubLocation() {
  Object.defineProperty(window, 'location', {
    value: { hash: '' },
    configurable: true,
    writable: true,
  });
}

function restoreLocation() {
  if (origLocation) Object.defineProperty(window, 'location', origLocation);
}

const ALBUM_DATA = {
  id: 42,
  album: 'Test Album',
  albumartist: 'Test Artist',
  year: 2020,
  has_cover: false,
  tagged: false,
  ignored: false,
  genres: [],
  discs: [],
  tracks: [],
};

const TRACKS = [
  {
    id: 1,
    title: 'Track 1',
    artist: 'Test Artist',
    track: 1,
    disc: 1,
    length: '3:00',
    has_lrc: false,
  },
  {
    id: 2,
    title: 'Track 2',
    artist: 'Test Artist',
    track: 2,
    disc: 1,
    length: '4:00',
    has_lrc: false,
  },
];

const ALBUM_WITH_TRACKS = { ...ALBUM_DATA, tracks: TRACKS };

function makeFetch(data = ALBUM_DATA, extraHandlers = {}) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/album/42') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    }
    for (const [pattern, handler] of Object.entries(extraHandlers)) {
      if (url.includes(pattern)) return handler(url);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('Album — breadcrumb navigation', () => {
  beforeEach(() => {
    stubLocation();
    vi.mocked(runLyricsFetchQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockResolvedValue();
    vi.stubGlobal('fetch', makeFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  it('renders the Library breadcrumb as a link with href="#/"', async () => {
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    const link = screen.getByRole('link', { name: /library/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#/');
  });

  it('renders the artist breadcrumb as a link with the correct href', async () => {
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    const link = screen.getByRole('link', { name: /Test Artist/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `#/artist/${encodeURIComponent('Test Artist')}`
    );
  });
});

describe('Album — Fetch all / AlbumLyricsModal', () => {
  beforeEach(() => {
    stubLocation();
    vi.mocked(runLyricsFetchQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  async function renderAndLoad(data = ALBUM_WITH_TRACKS, extraHandlers = {}) {
    vi.stubGlobal('fetch', makeFetch(data, extraHandlers));
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
  }

  it('clicking "Fetch all" opens AlbumLyricsModal without writing immediately', async () => {
    let queueResolve;
    vi.mocked(runLyricsFetchQueue).mockImplementation(
      () =>
        new Promise((r) => {
          queueResolve = r;
        })
    );

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // Modal eyebrow is visible
    expect(screen.getByText(/fetch all lyrics/i)).toBeInTheDocument();
    // No confirm was called
    const fetchCalls = vi.mocked(fetch).mock.calls.map(([url]) => url);
    expect(fetchCalls.some((u) => u.includes('confirm'))).toBe(false);

    act(() => queueResolve());
  });

  it('"Fetch all" button is disabled while the queue is running', async () => {
    let queueResolve;
    vi.mocked(runLyricsFetchQueue).mockImplementation(
      () =>
        new Promise((r) => {
          queueResolve = r;
        })
    );

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // The "Fetch all" button in the album hero should now be disabled.
    // After the modal opens, there is also "Apply all" in it.
    // Find the button inside the Lyrics action group.
    const lyricsGroup = document
      .querySelector('.action-group:last-of-type')
      ?.querySelector('button');
    expect(lyricsGroup).toBeDisabled();

    act(() => queueResolve());
  });

  it('re-launching Fetch all is blocked while the modal is open', async () => {
    vi.mocked(runLyricsFetchQueue).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // runLyricsFetchQueue was called once
    expect(vi.mocked(runLyricsFetchQueue)).toHaveBeenCalledOnce();

    // Clicking again while running should not call the queue again
    await act(async () => {
      fireEvent.click(
        document.querySelector('.action-group:last-of-type button')
      );
    });

    expect(vi.mocked(runLyricsFetchQueue)).toHaveBeenCalledOnce();
  });

  it('onTrackResult with found=true → row becomes found', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // Trigger a found result
    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'new lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    // Row should now show an individual Apply button
    expect(
      screen.getAllByRole('button', { name: /^apply$/i }).length
    ).toBeGreaterThan(0);
  });

  it('onTrackResult with found=false and currentLyrics → skipped', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: false,
        newLyrics: null,
        currentLyrics: 'existing lyrics',
        currentSource: 'embedded',
      });
    });

    expect(screen.getByText(/has lyrics/i)).toBeInTheDocument();
  });

  it('onTrackResult with found=false and empty currentLyrics → not-found', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: false,
        newLyrics: null,
        currentLyrics: '',
        currentSource: null,
      });
    });

    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('onTrackResult with status=error → error state', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        status: 'error',
        found: false,
        newLyrics: null,
        currentLyrics: null,
        currentSource: null,
      });
    });

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('"Apply all" sends confirm with only found item_ids', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    let confirmBody;
    await renderAndLoad(ALBUM_WITH_TRACKS, {
      'lyrics/confirm': () => {
        return {
          ok: true,
          json: () => {
            confirmBody = null; // populated below
            return Promise.resolve({
              written: 1,
              failed: [],
              written_item_ids: [1],
            });
          },
        };
      },
    });

    // Override fetch to capture confirm body
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ALBUM_WITH_TRACKS),
          });
        }
        if (url.includes('/lyrics/confirm') && !url.includes('track')) {
          confirmBody = JSON.parse(opts?.body || '{}');
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                written: 1,
                failed: [],
                written_item_ids: [1],
              }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // Make track 1 found, track 2 not-found
    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
      capturedOpts.onTrackResult({
        itemId: 2,
        found: false,
        newLyrics: null,
        currentLyrics: '',
        currentSource: null,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply all/i }));
    });

    await waitFor(() => expect(confirmBody).not.toBeNull());
    // Only found item (id=1) should be in the confirm request
    expect(confirmBody.item_ids).toEqual([1]);
  });

  it('rows become applied per written_item_ids; failed → error; others → found', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ALBUM_WITH_TRACKS),
          });
        }
        if (url.includes('/lyrics/confirm') && !url.includes('track')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                written: 1,
                failed: [2],
                written_item_ids: [1],
              }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    // Both tracks found
    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'a',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
      capturedOpts.onTrackResult({
        itemId: 2,
        found: true,
        newLyrics: 'b',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply all/i }));
    });

    // Track 1 → applied (in written_item_ids), track 2 → error (in failed)
    await waitFor(() => {
      expect(screen.getByText(/applied/i)).toBeInTheDocument();
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('individual Apply button moves row to applied on success and refreshes lyrics', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ALBUM_WITH_TRACKS),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok' }),
          });
        }
        if (url.includes('/track/1/lyrics') && !url.includes('confirm')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                has_lyrics: true,
                lyrics: 'lyrics',
                source: 'genius',
              }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    const applyBtns = screen.getAllByRole('button', { name: /^apply$/i });
    await act(async () => {
      fireEvent.click(applyBtns[0]);
    });

    await waitFor(() =>
      expect(screen.getByText(/applied/i)).toBeInTheDocument()
    );
  });

  it('confirmed write keeps the track green even when the authoritative refresh fails', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    // Track starts greyed out (has_lyrics:false) so we can prove the write
    // turns it green despite the refresh GET failing.
    const album = {
      ...ALBUM_DATA,
      tracks: [{ ...TRACKS[0], has_lyrics: false }],
    };
    await renderAndLoad(album);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(album),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok' }),
          });
        }
        // Authoritative refresh GET fails (transient backend/network error).
        if (url.includes('/track/1/lyrics') && !url.includes('confirm')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    const applyBtn = screen.getAllByRole('button', { name: /^apply$/i })[0];
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    // The write succeeded; the failed refresh must not leave the track grey.
    await waitFor(() => {
      const btn = document.querySelector('.track-mini-btn');
      expect(btn.classList.contains('track-mini-btn-has')).toBe(true);
    });
    const btn = document.querySelector('.track-mini-btn');
    expect(btn.classList.contains('track-mini-btn-empty')).toBe(false);
  });

  it('individual Apply failure reverts the row from applying back to found', async () => {
    let capturedOpts;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ALBUM_WITH_TRACKS),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'write failed' }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    const applyBtn = screen.getAllByRole('button', { name: /^apply$/i })[0];
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    // The failed write must not mark the row applied; it returns to `found`
    // (its Apply button reappears) so the user can retry.
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /^apply$/i }).length
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/applied/i)).not.toBeInTheDocument();
  });

  it('Apply button is disabled while any row is in applying state (double-click prevention)', async () => {
    let capturedOpts;
    let resolveConfirm;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });

    await renderAndLoad();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ALBUM_WITH_TRACKS),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          return new Promise((r) => {
            resolveConfirm = r;
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult({
        itemId: 1,
        found: true,
        newLyrics: 'lyrics',
        newSynced: false,
        newBackend: 'genius',
        currentLyrics: '',
        currentSource: null,
      });
    });

    const applyBtn = screen.getAllByRole('button', { name: /^apply$/i })[0];
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    // While confirm is in flight, both "Apply" and "Apply all" should be disabled
    expect(screen.getByRole('button', { name: /apply all/i })).toBeDisabled();

    // Clean up
    act(() =>
      resolveConfirm({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    );
  });

  it('closing the modal calls abort and hides the modal', async () => {
    let capturedSignal;
    vi.mocked(runLyricsFetchQueue).mockImplementation((opts) => {
      capturedSignal = opts.signal;
      return new Promise(() => {}); // never resolves
    });

    await renderAndLoad();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fetch all/i }));
    });

    expect(screen.getByText(/fetch all lyrics/i)).toBeInTheDocument();

    // Click the X close button inside the modal
    const closeBtn = document.querySelector('.modal-album-lyrics .btn-icon');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText(/fetch all lyrics/i)).not.toBeInTheDocument();
    expect(capturedSignal.aborted).toBe(true);
  });
});

describe('Album — lyrics color indication (Task 6)', () => {
  beforeEach(() => {
    stubLocation();
    vi.mocked(runLyricsFetchQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  async function renderWithTracks(tracks) {
    const data = { ...ALBUM_DATA, tracks };
    vi.stubGlobal('fetch', makeFetch(data));
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
  }

  it('track with has_lyrics:true shows track-mini-btn-has immediately on load (no lazy)', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
    ];
    await renderWithTracks(tracks);
    const btn = document.querySelector('.track-mini-btn');
    expect(btn.classList.contains('track-mini-btn-has')).toBe(true);
    expect(btn.classList.contains('track-mini-btn-empty')).toBe(false);
  });

  it('track with has_lyrics:false shows track-mini-btn-empty immediately on load', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
    ];
    await renderWithTracks(tracks);
    const btn = document.querySelector('.track-mini-btn');
    expect(btn.classList.contains('track-mini-btn-empty')).toBe(true);
    expect(btn.classList.contains('track-mini-btn-has')).toBe(false);
  });

  it('lyricsCache overrides initial has_lyrics (source precedence)', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (
          url.includes('/track/1/lyrics') &&
          !url.includes('confirm') &&
          !url.includes('fetch')
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                has_lyrics: true,
                lyrics: 'words',
                source: 'genius',
              }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Initially false from data
    let btn = document.querySelector('.track-mini-btn');
    expect(btn.classList.contains('track-mini-btn-empty')).toBe(true);

    // Expand the track row to trigger lazy load of lyricsCache
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      btn = document.querySelector('.track-mini-btn');
      expect(btn.classList.contains('track-mini-btn-has')).toBe(true);
    });
    expect(btn.classList.contains('track-mini-btn-empty')).toBe(false);
  });

  it('empty manual save on a track with a readable .lrc keeps it green when the refresh fails', async () => {
    // Track has an embedded/.lrc source (green). The backend preserves the .lrc
    // sidecar on an empty save and reports the authoritative post-save presence:
    // a readable sidecar means has_lyrics:true. The client seeds that, so even if
    // the authoritative refresh GET fails the track correctly stays green.
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: true,
        has_lyrics: true,
      },
    ];
    let lyricsGetCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/track/1/lyrics/save')) {
          // Empty save kept a readable sidecar → presence stays true.
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                has_lyrics: true,
                has_lrc: true,
              }),
          });
        }
        if (
          url.includes('/track/1/lyrics') &&
          !url.includes('confirm') &&
          !url.includes('fetch')
        ) {
          lyricsGetCount += 1;
          // First GET (lazy expand) succeeds; the post-save refresh GET fails.
          if (lyricsGetCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  has_lyrics: true,
                  lyrics: 'old words',
                  source: 'lrc_file',
                }),
            });
          }
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Expand the row (lazy GET seeds the cache green).
    await act(async () => {
      fireEvent.click(document.querySelector('.track-mini-btn'));
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-toolbar-actions')
      ).toBeInTheDocument()
    );

    // Open the editor, clear the text, and save empty.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    const textarea = document.querySelector('.lyrics-edit-textarea');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '' } });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });

    // The refresh GET failed, but the retained .lrc means the track must stay
    // green rather than being incorrectly greyed by a seeded false.
    await waitFor(() => {
      const btn = document.querySelector('.track-mini-btn');
      expect(btn.classList.contains('track-mini-btn-has')).toBe(true);
    });
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-empty')
    ).toBe(false);
  });

  it('empty save greys the track when the save reports no readable lyrics and the refresh fails', async () => {
    // Track loads green. An empty save clears the embedded text and the backend
    // reports the authoritative presence: no readable sidecar → has_lyrics:false.
    // The client seeds that, so even with a failing refresh GET the track greys
    // instead of staying stale-green.
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
    ];
    let lyricsGetCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/track/1/lyrics/save')) {
          // Empty save, no readable sidecar → presence is false.
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                has_lyrics: false,
                has_lrc: false,
              }),
          });
        }
        if (
          url.includes('/track/1/lyrics') &&
          !url.includes('confirm') &&
          !url.includes('fetch')
        ) {
          lyricsGetCount += 1;
          // 1: lazy expand (lyrics present). 2: refresh after the empty save fails.
          if (lyricsGetCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  has_lyrics: true,
                  lyrics: 'old words',
                  source: 'embedded',
                  has_lrc: false,
                }),
            });
          }
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Expand and seed the cache (lyrics present).
    await act(async () => {
      fireEvent.click(document.querySelector('.track-mini-btn'));
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-toolbar-actions')
      ).toBeInTheDocument()
    );

    // Empty save with a failing refresh: the save reports has_lyrics:false, so
    // the track greys.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    await act(async () => {
      fireEvent.change(document.querySelector('.lyrics-edit-textarea'), {
        target: { value: '' },
      });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });

    await waitFor(() => {
      const btn = document.querySelector('.track-mini-btn');
      expect(btn.classList.contains('track-mini-btn-empty')).toBe(true);
    });
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-has')
    ).toBe(false);
  });

  it('empty save greys a track whose retained .lrc is empty/unreadable (has_lrc is not a presence proxy)', async () => {
    // Regression: an online confirm embeds lyrics but a swallowed os.remove
    // leaves an empty/unreadable .lrc on disk (has_lrc:true). A later empty save
    // clears the embedded text; the backend preserves that .lrc. Because the
    // sidecar holds no readable lyrics, authoritative has_lyrics is false. The
    // save endpoint reports has_lyrics:false (not the has_lrc file-existence
    // flag), so the client greys the track instead of staying stale-green even
    // when the refresh GET fails.
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: true,
        has_lyrics: true,
      },
    ];
    let lyricsGetCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/track/1/lyrics/fetch')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                found: true,
                new_lyrics: 'fetched words',
                new_synced: false,
                new_backend: 'genius',
                current_lyrics: '',
                current_source: null,
              }),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          // Sidecar removal failed → an (empty/unreadable) .lrc lingers on disk.
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok', has_lrc: true }),
          });
        }
        if (url.includes('/track/1/lyrics/save')) {
          // Empty save kept the unreadable sidecar → presence is false.
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                has_lyrics: false,
                has_lrc: true,
              }),
          });
        }
        if (url.includes('/track/1/lyrics')) {
          lyricsGetCount += 1;
          // 1: lazy expand (no current lyrics). 2+: every refresh GET fails.
          if (lyricsGetCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  has_lyrics: false,
                  lyrics: '',
                  source: null,
                  has_lrc: true,
                }),
            });
          }
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Expand the row.
    await act(async () => {
      fireEvent.click(document.querySelector('.track-mini-btn'));
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-toolbar-actions')
      ).toBeInTheDocument()
    );

    // Fetch online (second toolbar button) → preview, then Confirm (embeds, but
    // the unreadable sidecar lingers).
    await act(async () => {
      fireEvent.click(
        document.querySelectorAll('.lyrics-toolbar-actions button')[1]
      );
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      ).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });
    await waitFor(() =>
      expect(
        document
          .querySelector('.track-mini-btn')
          .classList.contains('track-mini-btn-has')
      ).toBe(true)
    );

    // Empty save: the surviving sidecar is unreadable, so the save reports
    // has_lyrics:false and the track greys despite the failing refresh.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    await act(async () => {
      fireEvent.change(document.querySelector('.lyrics-edit-textarea'), {
        target: { value: '' },
      });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });

    await waitFor(() => {
      const btn = document.querySelector('.track-mini-btn');
      expect(btn.classList.contains('track-mini-btn-empty')).toBe(true);
    });
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-has')
    ).toBe(false);
  });

  it('keeps a track green after an empty save when a readable .lrc survives the write', async () => {
    // Online confirm reports has_lrc:true: the backend swallowed a failed .lrc
    // removal, so a readable sidecar still holds lyrics. A later empty save keeps
    // that sidecar; the save reports has_lyrics:true (readable sidecar present),
    // so the track stays green even though the refresh GET fails.
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: true,
        has_lyrics: true,
      },
    ];
    let lyricsGetCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/track/1/lyrics/fetch')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                found: true,
                new_lyrics: 'fetched words',
                new_synced: false,
                new_backend: 'genius',
                current_lyrics: 'old words',
                current_source: 'lrc_file',
              }),
          });
        }
        if (url.includes('/track/1/lyrics/confirm')) {
          // Sidecar removal failed → the readable sidecar lingers on disk.
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok', has_lrc: true }),
          });
        }
        if (url.includes('/track/1/lyrics/save')) {
          // Empty save kept a readable sidecar → presence stays true.
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                has_lyrics: true,
                has_lrc: true,
              }),
          });
        }
        if (url.includes('/track/1/lyrics')) {
          lyricsGetCount += 1;
          // 1: lazy expand (sidecar present). 2+: every refresh GET fails.
          if (lyricsGetCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  has_lyrics: true,
                  lyrics: 'old words',
                  source: 'lrc_file',
                  has_lrc: true,
                }),
            });
          }
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Expand and seed the cache (sidecar present).
    await act(async () => {
      fireEvent.click(document.querySelector('.track-mini-btn'));
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-toolbar-actions')
      ).toBeInTheDocument()
    );

    // Fetch online (second toolbar button) → preview, then Confirm.
    await act(async () => {
      fireEvent.click(
        document.querySelectorAll('.lyrics-toolbar-actions button')[1]
      );
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      ).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });
    await waitFor(() =>
      expect(
        document
          .querySelector('.track-mini-btn')
          .classList.contains('track-mini-btn-has')
      ).toBe(true)
    );

    // Empty save: the readable sidecar survives, so the save reports
    // has_lyrics:true and the track stays green despite the failing refresh.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    await act(async () => {
      fireEvent.change(document.querySelector('.lyrics-edit-textarea'), {
        target: { value: '' },
      });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });

    await waitFor(() =>
      expect(
        document
          .querySelector('.track-mini-btn')
          .classList.contains('track-mini-btn-has')
      ).toBe(true)
    );
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-empty')
    ).toBe(false);
  });

  it('a stale refresh GET from an earlier save does not clobber a newer save', async () => {
    // Two saves of the same track in quick succession. Save A keeps lyrics
    // (green); save B clears them (grey). Each save fires an authoritative
    // refresh GET; the GETs resolve out of order (B then A). The older GET (A,
    // green) must NOT overwrite the newer authoritative state (B, grey).
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
    ];
    let getCount = 0;
    let saveCount = 0;
    const deferredGets = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/track/1/lyrics/save')) {
          saveCount += 1;
          const hasLyrics = saveCount === 1; // A keeps lyrics, B clears them
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                has_lyrics: hasLyrics,
                has_lrc: false,
              }),
          });
        }
        if (
          url.includes('/track/1/lyrics') &&
          !url.includes('save') &&
          !url.includes('confirm') &&
          !url.includes('fetch')
        ) {
          getCount += 1;
          if (getCount === 1) {
            // Lazy expand seeds the cache green.
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  has_lyrics: true,
                  lyrics: 'old words',
                  source: 'embedded',
                }),
            });
          }
          // Refresh GETs (2 = save A, 3 = save B) are resolved manually below.
          const isSaveA = getCount === 2;
          let resolveOuter;
          const p = new Promise((res) => {
            resolveOuter = res;
          });
          deferredGets.push(() =>
            resolveOuter({
              ok: true,
              json: () =>
                Promise.resolve(
                  isSaveA
                    ? {
                        has_lyrics: true,
                        lyrics: 'words A',
                        source: 'embedded',
                      }
                    : { has_lyrics: false, lyrics: '', source: null }
                ),
            })
          );
          return p;
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Expand the row (lazy GET seeds the cache green).
    await act(async () => {
      fireEvent.click(document.querySelector('.track-mini-btn'));
    });
    await waitFor(() =>
      expect(
        document.querySelector('.lyrics-toolbar-actions')
      ).toBeInTheDocument()
    );

    // Save A: keep some lyrics. Its refresh GET stays pending.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    await act(async () => {
      fireEvent.change(document.querySelector('.lyrics-edit-textarea'), {
        target: { value: 'words A' },
      });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });

    // Save B: clear the lyrics. Its refresh GET also stays pending; the seed
    // already greys the track.
    await act(async () => {
      fireEvent.click(document.querySelector('.lyrics-toolbar-actions button'));
    });
    await act(async () => {
      fireEvent.change(document.querySelector('.lyrics-edit-textarea'), {
        target: { value: '' },
      });
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('.lyrics-edit-actions .btn-primary')
      );
    });
    await waitFor(() =>
      expect(
        document
          .querySelector('.track-mini-btn')
          .classList.contains('track-mini-btn-empty')
      ).toBe(true)
    );

    // Resolve out of order: B (newest, grey) first, then A (stale, green).
    expect(deferredGets).toHaveLength(2);
    await act(async () => {
      deferredGets[1]();
    });
    await act(async () => {
      deferredGets[0]();
    });

    // The stale green GET must be ignored — the track stays grey.
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-empty')
    ).toBe(true);
    expect(
      document
        .querySelector('.track-mini-btn')
        .classList.contains('track-mini-btn-has')
    ).toBe(false);
  });

  it('track-mini-btn-has and track-mini-btn-empty are mutually exclusive', async () => {
    const tracks = [
      {
        id: 1,
        title: 'Has',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
      {
        id: 2,
        title: 'Empty',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
    ];
    await renderWithTracks(tracks);
    const btns = document.querySelectorAll('.track-mini-btn');
    // Each button has exactly one or neither of the modifier classes, never both
    for (const btn of btns) {
      expect(
        btn.classList.contains('track-mini-btn-has') &&
          btn.classList.contains('track-mini-btn-empty')
      ).toBe(false);
    }
    // Each track row has 3 mini-btns (lyrics, bpm, tags); lyrics is index 0 per row
    // btns[0] = track-1 lyrics btn (has_lyrics:true), btns[3] = track-2 lyrics btn (has_lyrics:false)
    expect(btns[0].classList.contains('track-mini-btn-has')).toBe(true);
    expect(btns[3].classList.contains('track-mini-btn-empty')).toBe(true);
  });

  it('album Fetch-all button is neutral (no extra class) when 0 tracks have lyrics', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
    ];
    await renderWithTracks(tracks);
    const fetchAllBtn = document.querySelector(
      '.action-group:last-of-type button'
    );
    expect(fetchAllBtn.classList.contains('lyrics-agg-partial')).toBe(false);
    expect(fetchAllBtn.classList.contains('lyrics-agg-all')).toBe(false);
  });

  it('album Fetch-all button has lyrics-agg-partial when some (but not all) tracks have lyrics', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: false,
      },
    ];
    await renderWithTracks(tracks);
    const fetchAllBtn = document.querySelector(
      '.action-group:last-of-type button'
    );
    expect(fetchAllBtn.classList.contains('lyrics-agg-partial')).toBe(true);
    expect(fetchAllBtn.classList.contains('lyrics-agg-all')).toBe(false);
  });

  it('album Fetch-all button has lyrics-agg-all when all tracks have lyrics', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_lrc: false,
        has_lyrics: true,
      },
    ];
    await renderWithTracks(tracks);
    const fetchAllBtn = document.querySelector(
      '.action-group:last-of-type button'
    );
    expect(fetchAllBtn.classList.contains('lyrics-agg-all')).toBe(true);
    expect(fetchAllBtn.classList.contains('lyrics-agg-partial')).toBe(false);
  });
});

describe('Album — BPM buttons and AlbumBpmModal (Task 7)', () => {
  beforeEach(() => {
    stubLocation();
    vi.mocked(runLyricsFetchQueue).mockReset();
    vi.mocked(runLyricsFetchQueue).mockResolvedValue();
    vi.mocked(runBpmComputeQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  async function renderWithTracks(tracks) {
    const data = { ...ALBUM_DATA, tracks };
    vi.stubGlobal('fetch', makeFetch(data));
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
  }

  it('BPM button shows track-mini-btn-has when has_bpm:true', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: true,
      },
    ];
    await renderWithTracks(tracks);
    // buttons: [0]=lyrics, [1]=bpm, [2]=tags, [3]=edit
    const btns = document.querySelectorAll('.track-mini-btn');
    expect(btns[1].classList.contains('track-mini-btn-has')).toBe(true);
    expect(btns[1].classList.contains('track-mini-btn-empty')).toBe(false);
  });

  it('BPM button shows the numeric value as its label on first paint', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: true,
        bpm: 128,
      },
    ];
    await renderWithTracks(tracks);
    const btns = document.querySelectorAll('.track-mini-btn');
    const label = btns[1].querySelector('.mini-label');
    expect(label.textContent).toBe('128');
    expect(label.classList.contains('mini-bpm')).toBe(true);
    expect(btns[1].getAttribute('title')).toBe('128 BPM');
  });

  it('BPM button falls back to "bpm"/"no bpm" label when no number is known', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
        bpm: null,
      },
    ];
    await renderWithTracks(tracks);
    const btns = document.querySelectorAll('.track-mini-btn');
    const label = btns[1].querySelector('.mini-label');
    expect(label.textContent).toBe('no bpm');
    expect(label.classList.contains('mini-bpm')).toBe(false);
  });

  it('BPM button shows track-mini-btn-empty when has_bpm:false', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    await renderWithTracks(tracks);
    const btns = document.querySelectorAll('.track-mini-btn');
    expect(btns[1].classList.contains('track-mini-btn-empty')).toBe(true);
    expect(btns[1].classList.contains('track-mini-btn-has')).toBe(false);
  });

  it('bpmAgg neutral: no agg class on Compute all when no tracks have BPM', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    await renderWithTracks(tracks);
    const btn = screen.getByRole('button', { name: /compute all/i });
    expect(btn.classList.contains('lyrics-agg-partial')).toBe(false);
    expect(btn.classList.contains('lyrics-agg-all')).toBe(false);
  });

  it('bpmAgg partial: lyrics-agg-partial on Compute all when some tracks have BPM', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: true,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    await renderWithTracks(tracks);
    const btn = screen.getByRole('button', { name: /compute all/i });
    expect(btn.classList.contains('lyrics-agg-partial')).toBe(true);
    expect(btn.classList.contains('lyrics-agg-all')).toBe(false);
  });

  it('bpmAgg all: lyrics-agg-all on Compute all when all tracks have BPM', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: true,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_bpm: true,
      },
    ];
    await renderWithTracks(tracks);
    const btn = screen.getByRole('button', { name: /compute all/i });
    expect(btn.classList.contains('lyrics-agg-all')).toBe(true);
    expect(btn.classList.contains('lyrics-agg-partial')).toBe(false);
  });

  it('clicking Compute all opens AlbumBpmModal', async () => {
    vi.mocked(runBpmComputeQueue).mockImplementation(
      () => new Promise(() => {}) // never resolves (queue still running)
    );
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    expect(screen.getByText(/compute all bpm/i)).toBeInTheDocument();
  });

  it('Compute all button is disabled while the queue is running', async () => {
    vi.mocked(runBpmComputeQueue).mockImplementation(
      () => new Promise(() => {})
    );
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    expect(screen.getByRole('button', { name: /compute all/i })).toBeDisabled();
  });

  it('re-clicking Compute all while running does not call the queue again', async () => {
    vi.mocked(runBpmComputeQueue).mockImplementation(
      () => new Promise(() => {})
    );
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    expect(vi.mocked(runBpmComputeQueue)).toHaveBeenCalledOnce();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    expect(vi.mocked(runBpmComputeQueue)).toHaveBeenCalledOnce();
  });

  it('onTrackStart transitions the row from pending to computing', async () => {
    let capturedOpts;
    vi.mocked(runBpmComputeQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return new Promise(() => {});
    });
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    // Initially pending
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);

    // onTrackStart fires for track 1
    await act(async () => {
      capturedOpts.onTrackStart(1);
    });

    // Track 1 row should now be computing
    expect(screen.getByText(/computing/i)).toBeInTheDocument();
  });

  it('onTrackResult success: row becomes done and bpmAgg updates', async () => {
    let capturedOpts;
    vi.mocked(runBpmComputeQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult(1, { bpm: 120 });
      capturedOpts.onTrackResult(2, { bpm: 140 });
    });

    // Both rows should show done state with BPM
    expect(screen.getByText(/120 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/140 bpm/i)).toBeInTheDocument();
  });

  it('onTrackResult error: row becomes error state', async () => {
    let capturedOpts;
    vi.mocked(runBpmComputeQueue).mockImplementation((opts) => {
      capturedOpts = opts;
      return Promise.resolve();
    });
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    await act(async () => {
      capturedOpts.onTrackResult(1, { error: true });
    });

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('bpmCache updates after per-track BPM compute and button turns green', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/bpm/compute')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok', bpm: 120 }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // BPM button (index 1) starts empty
    let btns = document.querySelectorAll('.track-mini-btn');
    expect(btns[1].classList.contains('track-mini-btn-empty')).toBe(true);

    await act(async () => {
      fireEvent.click(btns[1]);
    });

    await waitFor(() => {
      btns = document.querySelectorAll('.track-mini-btn');
      expect(btns[1].classList.contains('track-mini-btn-has')).toBe(true);
    });
    expect(btns[1].classList.contains('track-mini-btn-empty')).toBe(false);
    // The computed value (120) replaces the label once the cache updates.
    const label = btns[1].querySelector('.mini-label');
    expect(label.textContent).toBe('120');
    expect(label.classList.contains('mini-bpm')).toBe(true);
  });

  it('Compute all is disabled and inert while a per-track BPM compute is in flight', async () => {
    // Regression: a per-track compute is a file/DB write. An album-wide run must
    // not start while one is running — it would re-issue a compute for that same
    // track and risk concurrent tag writes.
    let resolveCompute;
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
      {
        id: 2,
        title: 'T2',
        artist: 'A',
        track: 2,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/bpm/compute')) {
          // Keep the per-track write pending so the busy state persists.
          return new Promise((res) => {
            resolveCompute = () =>
              res({
                ok: true,
                json: () => Promise.resolve({ status: 'ok', bpm: 120 }),
              });
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Start a per-track BPM compute (track 1's BPM mini-button is index 1).
    const btns = document.querySelectorAll('.track-mini-btn');
    await act(async () => {
      fireEvent.click(btns[1]);
    });

    // While that write is in flight, "Compute all" is disabled and clicking it
    // does not start the album queue.
    const computeAll = screen.getByRole('button', { name: /compute all/i });
    expect(computeAll).toBeDisabled();
    await act(async () => {
      fireEvent.click(computeAll);
    });
    expect(vi.mocked(runBpmComputeQueue)).not.toHaveBeenCalled();

    // Once the per-track compute settles, "Compute all" is enabled again.
    await act(async () => {
      resolveCompute();
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /compute all/i })
      ).not.toBeDisabled()
    );
  });

  it('per-track BPM error shows a flash message', async () => {
    const tracks = [
      {
        id: 1,
        title: 'T1',
        artist: 'A',
        track: 1,
        disc: 1,
        length: '3:00',
        has_bpm: false,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/42') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...ALBUM_DATA, tracks }),
          });
        }
        if (url.includes('/bpm/compute')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'BPM computation failed' }),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    const btns = document.querySelectorAll('.track-mini-btn');
    await act(async () => {
      fireEvent.click(btns[1]);
    });

    await waitFor(() => {
      expect(screen.getByText(/bpm computation failed/i)).toBeInTheDocument();
    });
  });

  it('closing BPM modal via backdrop hides it', async () => {
    vi.mocked(runBpmComputeQueue).mockImplementation(
      () => new Promise(() => {})
    );
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    expect(screen.getByText(/compute all bpm/i)).toBeInTheDocument();

    // The Close button is disabled while computing; click the backdrop instead.
    const backdrop = document.querySelector('.modal-backdrop');
    await act(async () => {
      fireEvent.click(backdrop);
    });

    expect(screen.queryByText(/compute all bpm/i)).not.toBeInTheDocument();
  });

  it('Compute all re-enables after closing the modal mid-run once the queue settles', async () => {
    // Regression: closing the modal nulls the run token; the queue settle must
    // still release the run lock, otherwise "Compute all" stays disabled forever.
    let resolveQueue;
    vi.mocked(runBpmComputeQueue).mockImplementation(
      () =>
        new Promise((res) => {
          resolveQueue = res;
        })
    );
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    // Close the modal while requests are still in flight.
    const backdrop = document.querySelector('.modal-backdrop');
    await act(async () => {
      fireEvent.click(backdrop);
    });
    expect(screen.queryByText(/compute all bpm/i)).not.toBeInTheDocument();

    // Lock is still held until the queue promise settles (overlapping-run guard).
    expect(screen.getByRole('button', { name: /compute all/i })).toBeDisabled();

    // Once the in-flight requests settle, the lock releases and a new run is allowed.
    await act(async () => {
      resolveQueue();
      await Promise.resolve();
    });
    expect(
      screen.getByRole('button', { name: /compute all/i })
    ).not.toBeDisabled();
  });

  it('closing BPM modal aborts the queue signal', async () => {
    let capturedSignal;
    vi.mocked(runBpmComputeQueue).mockImplementation((opts) => {
      capturedSignal = opts.signal;
      return new Promise(() => {});
    });
    await renderWithTracks(TRACKS);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compute all/i }));
    });

    // Close via backdrop since the Close button is disabled while computing.
    const backdrop = document.querySelector('.modal-backdrop');
    await act(async () => {
      fireEvent.click(backdrop);
    });

    expect(capturedSignal.aborted).toBe(true);
  });
});

describe('Album — TagsModal Edit button / ItemTagsEditor (Task 6 entry point A)', () => {
  const TAGS_RESPONSE = { title: 'Track 1', artist: 'Test Artist', track: 1 };
  const FIELDS_RESPONSE = [
    { name: 'title', type: 'str', editable: true, album_level: false },
    { name: 'artist', type: 'str', editable: true, album_level: false },
    { name: 'track', type: 'int', editable: true, album_level: false },
  ];

  function makeFullFetch(extraHandlers = {}) {
    return vi.fn().mockImplementation((url) => {
      if (url === '/api/album/42') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(ALBUM_WITH_TRACKS),
        });
      }
      if (url.includes('/track/') && url.endsWith('/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(TAGS_RESPONSE),
        });
      }
      if (url === '/api/items/fields') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(FIELDS_RESPONSE),
        });
      }
      for (const [pattern, handler] of Object.entries(extraHandlers)) {
        if (url.includes(pattern)) return handler(url);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
  }

  beforeEach(() => {
    stubLocation();
    vi.mocked(runLyricsFetchQueue).mockReset();
    vi.mocked(runLyricsFetchQueue).mockResolvedValue();
    vi.mocked(runBpmComputeQueue).mockReset();
    vi.mocked(runBpmComputeQueue).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  async function renderAndLoad() {
    vi.stubGlobal('fetch', makeFullFetch());
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
  }

  async function openTagsModal() {
    // tags mini-button is index 2 per track row
    const btns = document.querySelectorAll('.track-mini-btn');
    await act(async () => {
      fireEvent.click(btns[2]);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
  }

  function getModal() {
    return document.querySelector('.modal');
  }

  it('TagsModal renders an Edit button when tags are loaded', async () => {
    await renderAndLoad();
    await openTagsModal();
    expect(
      within(getModal()).getByRole('button', { name: /^edit$/i })
    ).toBeInTheDocument();
  });

  it('clicking Edit in TagsModal opens ItemTagsEditor', async () => {
    await renderAndLoad();
    await openTagsModal();

    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^edit$/i })
      );
    });

    await waitFor(() =>
      expect(screen.getByText(/edit all tags/i)).toBeInTheDocument()
    );
  });

  it('cancelling ItemTagsEditor restores TagsModal', async () => {
    await renderAndLoad();
    await openTagsModal();

    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^edit$/i })
      );
    });
    await waitFor(() =>
      expect(screen.getByText(/edit all tags/i)).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /cancel/i })
      );
    });

    await waitFor(() =>
      expect(screen.queryByText(/edit all tags/i)).not.toBeInTheDocument()
    );
    // TagsModal reappears
    expect(
      within(getModal()).getByRole('button', { name: /close/i })
    ).toBeInTheDocument();
  });

  it('saving in ItemTagsEditor re-fetches tags and shows TagsModal', async () => {
    let patchCalled = false;
    vi.stubGlobal(
      'fetch',
      makeFullFetch({
        '/items/1/tags': () => {
          patchCalled = true;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'ok', warnings: [] }),
          });
        },
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    await openTagsModal();

    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^edit$/i })
      );
    });
    await waitFor(() =>
      expect(screen.getByText(/edit all tags/i)).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(document.querySelectorAll('.ite-input').length).toBeGreaterThan(0)
    );
    const inputs = document.querySelectorAll('.ite-input');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'New Title' } });
    });
    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^save$/i })
      );
    });

    await waitFor(() => expect(patchCalled).toBe(true));

    // ItemTagsEditor closes and TagsModal re-opens
    await waitFor(() =>
      expect(screen.queryByText(/edit all tags/i)).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        within(getModal()).getByRole('button', { name: /close/i })
      ).toBeInTheDocument()
    );
  });

  it('keeps the editor open and shows warnings on a partial-success save', async () => {
    vi.stubGlobal(
      'fetch',
      makeFullFetch({
        '/items/1/tags': () =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'ok',
                warnings: ['file write failed: /music/track1.mp3'],
              }),
          }),
      })
    );
    await act(async () => {
      render(<Album id={42} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    await openTagsModal();

    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^edit$/i })
      );
    });
    await waitFor(() =>
      expect(screen.getByText(/edit all tags/i)).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(document.querySelectorAll('.ite-input').length).toBeGreaterThan(0)
    );
    const inputs = document.querySelectorAll('.ite-input');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'New Title' } });
    });
    await act(async () => {
      fireEvent.click(
        within(getModal()).getByRole('button', { name: /^save$/i })
      );
    });

    // Editor stays mounted and the file-write warning is visible (not swallowed)
    await waitFor(() =>
      expect(screen.getByText(/file write failed/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/edit all tags/i)).toBeInTheDocument();
  });
});
