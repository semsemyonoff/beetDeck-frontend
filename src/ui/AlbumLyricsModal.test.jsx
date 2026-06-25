import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlbumLyricsModal from './AlbumLyricsModal.jsx';

function makeTrack(id, state, extras = {}) {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    track: id,
    disc: 1,
    state,
    newLyrics: null,
    currentLyrics: null,
    ...extras,
  };
}

const PROGRESS = { done: 0, total: 3 };

function renderModal(overrides = {}) {
  const defaults = {
    tracks: [],
    progress: PROGRESS,
    applying: false,
    onApplyAll: vi.fn(),
    onApplyOne: vi.fn(),
    onClose: vi.fn(),
  };
  return render(<AlbumLyricsModal {...defaults} {...overrides} />);
}

describe('AlbumLyricsModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all row states without crashing', () => {
    const tracks = [
      makeTrack(1, 'pending'),
      makeTrack(2, 'found', {
        newLyrics: 'new lyrics',
        currentLyrics: 'old lyrics',
      }),
      makeTrack(3, 'applying'),
      makeTrack(4, 'applied'),
      makeTrack(5, 'skipped'),
      makeTrack(6, 'not-found'),
      makeTrack(7, 'error'),
    ];
    renderModal({ tracks, progress: { done: 4, total: 7 } });

    expect(screen.getByText('Track 1')).toBeInTheDocument();
    expect(screen.getByText('Track 2')).toBeInTheDocument();
    expect(screen.getByText(/applied/i)).toBeInTheDocument();
    expect(screen.getByText(/has lyrics/i)).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
    // found row shows side-by-side compare
    expect(screen.getByText('old lyrics')).toBeInTheDocument();
    expect(screen.getByText('new lyrics')).toBeInTheDocument();
    // applying row shows spinner text
    expect(screen.getByText(/applying/i)).toBeInTheDocument();
  });

  it('"Apply all" is in the modal header', () => {
    const tracks = [
      makeTrack(1, 'found', { newLyrics: 'x', currentLyrics: '' }),
    ];
    renderModal({ tracks });
    const header = document.querySelector('.modal-head');
    const applyAllBtn = screen.getByRole('button', { name: /apply all/i });
    expect(header).toContainElement(applyAllBtn);
  });

  it('"Apply all" calls onApplyAll with ids of found tracks only', () => {
    const onApplyAll = vi.fn();
    const tracks = [
      makeTrack(1, 'found', { newLyrics: 'a', currentLyrics: '' }),
      makeTrack(2, 'applied'),
      makeTrack(3, 'found', { newLyrics: 'b', currentLyrics: '' }),
      makeTrack(4, 'skipped'),
    ];
    renderModal({ tracks, onApplyAll });
    fireEvent.click(screen.getByRole('button', { name: /apply all/i }));
    expect(onApplyAll).toHaveBeenCalledOnce();
    expect(onApplyAll).toHaveBeenCalledWith([1, 3]);
  });

  it('individual Apply button calls onApplyOne with the track id', () => {
    const onApplyOne = vi.fn();
    const tracks = [
      makeTrack(5, 'found', { newLyrics: 'lyrics', currentLyrics: '' }),
    ];
    renderModal({ tracks, onApplyOne });
    // "Apply all" is in header; individual "Apply" is in the row
    const allBtns = screen.getAllByRole('button', { name: /^apply$/i });
    expect(allBtns).toHaveLength(1);
    fireEvent.click(allBtns[0]);
    expect(onApplyOne).toHaveBeenCalledWith(5);
  });

  it('"Apply" and "Apply all" buttons are disabled while applying=true', () => {
    const tracks = [
      makeTrack(1, 'found', { newLyrics: 'lyrics', currentLyrics: '' }),
    ];
    renderModal({ tracks, applying: true });
    expect(screen.getByRole('button', { name: /apply all/i })).toBeDisabled();
    const applyBtns = screen.getAllByRole('button', { name: /^apply$/i });
    expect(applyBtns[0]).toBeDisabled();
  });

  it('"Apply all" is disabled when there are no found tracks', () => {
    const tracks = [makeTrack(1, 'pending'), makeTrack(2, 'applied')];
    renderModal({ tracks });
    expect(screen.getByRole('button', { name: /apply all/i })).toBeDisabled();
  });

  it('shows "ready to apply: K" counter when there are found tracks', () => {
    const tracks = [
      makeTrack(1, 'found', { newLyrics: 'a', currentLyrics: '' }),
      makeTrack(2, 'found', { newLyrics: 'b', currentLyrics: '' }),
    ];
    renderModal({ tracks });
    expect(screen.getByText(/ready to apply: 2/i)).toBeInTheDocument();
  });

  it('does not show "ready to apply" counter when no found tracks', () => {
    const tracks = [makeTrack(1, 'pending')];
    renderModal({ tracks });
    expect(screen.queryByText(/ready to apply/i)).not.toBeInTheDocument();
  });

  it('shows progress text from progress prop', () => {
    renderModal({ tracks: [], progress: { done: 3, total: 8 } });
    expect(screen.getByText(/3 of 8 fetched/i)).toBeInTheDocument();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(document.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('found row with empty current lyrics shows "(empty)" in compare pane', () => {
    const tracks = [
      makeTrack(1, 'found', { newLyrics: 'some lyrics', currentLyrics: '' }),
    ];
    renderModal({ tracks });
    expect(screen.getByText('(empty)')).toBeInTheDocument();
    expect(screen.getByText('some lyrics')).toBeInTheDocument();
  });

  it('multi-disc track shows disc prefix in track label', () => {
    const tracks = [{ ...makeTrack(3, 'pending'), disc: 2, track: 3 }];
    renderModal({ tracks });
    expect(screen.getByText('2-03')).toBeInTheDocument();
  });
});
