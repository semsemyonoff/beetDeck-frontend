import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ItemsIdentifyModal from './ItemsIdentifyModal.jsx';

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

function fail(body, status = 400) {
  return { ok: false, status, json: async () => body };
}

const CANDIDATE = {
  mb_albumid: 'abc-123',
  album: 'Found Album',
  artist: 'Found Artist',
  year: 2022,
  distance: 0.05,
  track_count: 10,
};

const APPLY_DATA = {
  album: {
    album: { old: '', new: 'Found Album' },
    albumartist: { old: '', new: 'Found Artist' },
  },
  tracks: [],
};

const BASE = {
  itemIds: [1, 2, 3],
  searchArtist: 'Found Artist',
  searchAlbum: 'Found Album',
};

describe('ItemsIdentifyModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('auto-starts search and shows searching state immediately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(ok({ status: 'started', task_id: 't1' }))
    );
    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={vi.fn()} />);
    });
    expect(screen.getByText(/querying musicbrainz/i)).toBeInTheDocument();
  });

  it('happy path: searching → results → confirm navigates to album', async () => {
    const origLocation = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      configurable: true,
      writable: true,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ status: 'started', task_id: 't1' })) // POST /api/items/identify
      .mockResolvedValueOnce(ok({ status: 'done', candidates: [CANDIDATE] })) // GET status
      .mockResolvedValueOnce(ok(APPLY_DATA)) // POST apply
      .mockResolvedValueOnce(ok({ status: 'ok', album_id: 42 })); // POST confirm
    vi.stubGlobal('fetch', fetchMock);

    const onClose = vi.fn();
    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={onClose} />);
    });

    // Fire poll timer and drain async chain
    await act(async () => {
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Results phase — "Found Album" appears in the header and candidate list
    expect(screen.getAllByText('Found Album').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 matches/)).toBeInTheDocument();

    // Confirm button enabled
    const confirmBtn = screen.getByRole('button', { name: /apply/i });
    expect(confirmBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // onClose called and navigated
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('#/album/42');

    if (origLocation) Object.defineProperty(window, 'location', origLocation);
  });

  it('POSTs identify with correct item_ids, search_artist, search_album', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ status: 'started', task_id: 't1' }))
      .mockResolvedValue(ok({ status: 'running' }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={vi.fn()} />);
    });

    const identifyCall = fetchMock.mock.calls[0];
    expect(identifyCall[0]).toBe('/api/items/identify');
    const body = JSON.parse(identifyCall[1].body);
    expect(body.item_ids).toEqual([1, 2, 3]);
    expect(body.search_artist).toBe('Found Artist');
    expect(body.search_album).toBe('Found Album');
  });

  it('no candidates → error phase with Retry button', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ status: 'started', task_id: 't1' }))
      .mockResolvedValueOnce(ok({ status: 'done', candidates: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={vi.fn()} />);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/no candidates/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('error on identify start → error phase', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail({ error: 'item_ids required' }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={vi.fn()} />);
    });

    expect(screen.getByText(/item_ids required/i)).toBeInTheDocument();
  });

  it('Escape / backdrop click calls onClose', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(ok({ status: 'started', task_id: 't1' }))
    );
    const onClose = vi.fn();
    await act(async () => {
      render(<ItemsIdentifyModal {...BASE} onClose={onClose} />);
    });

    // Backdrop click
    fireEvent.click(document.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
