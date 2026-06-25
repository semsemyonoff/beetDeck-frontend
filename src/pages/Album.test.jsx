import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
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
    // Each track row has 3 mini-btns (lyrics, tags, edit); lyrics is index 0 per row
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
