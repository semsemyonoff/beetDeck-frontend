import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import IdentifyModal from './IdentifyModal.jsx';

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

const CANDIDATE = {
  mb_albumid: 'abc-123',
  album: 'Found Album',
  artist: 'Found Artist',
  year: 2020,
  distance: 0.05,
  track_count: 10,
};

const APPLY = {
  album: { year: { old: '2019', new: '2020' } },
  tracks: [],
};

const BASE = {
  albumId: 1,
  artistName: 'Test Artist',
  albumTitle: 'Test Album',
  albumYear: '2020',
};

describe('IdentifyModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders search form phase by default', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<IdentifyModal {...BASE} onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.getByRole('button', { name: /search musicbrainz/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('Cancel in form phase calls onClose', () => {
    vi.stubGlobal('fetch', vi.fn());
    const onClose = vi.fn();
    render(<IdentifyModal {...BASE} onClose={onClose} onConfirmed={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('happy path: form → searching → results → confirm', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({})) // POST .../identify
      .mockResolvedValueOnce(ok({ status: 'done', candidates: [CANDIDATE] })) // GET .../identify/status
      .mockResolvedValueOnce(ok(APPLY)) // POST .../apply
      .mockResolvedValueOnce(ok({ ok: true })); // POST .../confirm
    vi.stubGlobal('fetch', fetchMock);

    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    render(<IdentifyModal {...BASE} onClose={onClose} onConfirmed={onConfirmed} />);

    // Trigger search — identify POST fires, setTimeout(pollStatus, 400) is queued
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /search musicbrainz/i }));
    });
    expect(screen.getByText(/querying musicbrainz/i)).toBeInTheDocument();

    // Fire poll timer and drain the async chain: pollStatus → status fetch → loadApply → apply fetch
    await act(async () => {
      await vi.runAllTimersAsync();
      // Extra microtask flushes for loadApply's floating promise inside pollStatus
      await Promise.resolve();
      await Promise.resolve();
    });

    // Results phase: candidate list visible (title + count header)
    expect(screen.getByText('Found Album')).toBeInTheDocument();
    expect(screen.getByText(/1 matches/)).toBeInTheDocument();

    // Confirm button is enabled (applyLoading resolved)
    const confirmBtn = screen.getByRole('button', { name: /apply/i });
    expect(confirmBtn).not.toBeDisabled();

    // Confirm → onConfirmed + onClose
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('no candidates → error phase with back-to-search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ status: 'done', candidates: [] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<IdentifyModal {...BASE} onClose={vi.fn()} onConfirmed={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /search musicbrainz/i }));
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/no candidates/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to search/i })).toBeInTheDocument();
  });

  it('Refine search returns to form with preserved search params', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ status: 'done', candidates: [CANDIDATE] }))
      .mockResolvedValueOnce(ok(APPLY));
    vi.stubGlobal('fetch', fetchMock);

    render(<IdentifyModal {...BASE} onClose={vi.fn()} onConfirmed={vi.fn()} />);

    // Type a custom artist override before searching
    fireEvent.change(screen.getByPlaceholderText('Override artist search'), {
      target: { value: 'Custom Query' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /search musicbrainz/i }));
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Results phase shows the Refine search button
    expect(screen.getByRole('button', { name: /refine search/i })).toBeInTheDocument();

    // Navigate back to form
    fireEvent.click(screen.getByRole('button', { name: /refine search/i }));

    // Form is restored with the previously typed value
    expect(screen.getByDisplayValue('Custom Query')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search musicbrainz/i })).toBeInTheDocument();
  });
});
