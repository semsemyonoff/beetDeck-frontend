import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlbumBpmModal from './AlbumBpmModal.jsx';

function makeTrack(id, state, extras = {}) {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    track: id,
    disc: 1,
    state,
    bpm: null,
    ...extras,
  };
}

const PROGRESS = { done: 0, total: 3 };

function renderModal(overrides = {}) {
  const defaults = {
    tracks: [],
    progress: PROGRESS,
    computing: false,
    onClose: vi.fn(),
  };
  return render(<AlbumBpmModal {...defaults} {...overrides} />);
}

describe('AlbumBpmModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all row states without crashing', () => {
    const tracks = [
      makeTrack(1, 'pending'),
      makeTrack(2, 'computing'),
      makeTrack(3, 'done', { bpm: 120 }),
      makeTrack(4, 'error'),
    ];
    renderModal({ tracks, progress: { done: 2, total: 4 } });

    expect(screen.getByText('Track 1')).toBeInTheDocument();
    expect(screen.getByText('Track 2')).toBeInTheDocument();
    expect(screen.getByText('Track 3')).toBeInTheDocument();
    expect(screen.getByText('Track 4')).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/computing/i)).toBeInTheDocument();
    expect(screen.getByText(/120 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('shows progress text from progress prop', () => {
    renderModal({ tracks: [], progress: { done: 3, total: 8 } });
    expect(screen.getByText(/3 of 8 computed/i)).toBeInTheDocument();
  });

  it('progress bar fill width reflects pct', () => {
    const { container } = renderModal({
      tracks: [],
      progress: { done: 1, total: 4 },
    });
    const fill = container.querySelector('.abm-progress-fill');
    expect(fill).toHaveStyle({ width: '25%' });
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

  it('close button click calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close button is disabled while computing', () => {
    renderModal({ computing: true });
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
  });

  it('close button shows spinner while computing', () => {
    renderModal({ computing: true });
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn.querySelector('.btn-spinner')).toBeInTheDocument();
  });

  it('done row shows BPM value', () => {
    const tracks = [makeTrack(1, 'done', { bpm: 172 })];
    renderModal({ tracks });
    expect(screen.getByText(/172 bpm/i)).toBeInTheDocument();
  });

  it('done row with null bpm shows "Done"', () => {
    const tracks = [makeTrack(1, 'done', { bpm: null })];
    renderModal({ tracks });
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  it('computing row shows spinner', () => {
    const tracks = [makeTrack(1, 'computing')];
    const { container } = renderModal({ tracks });
    const row = container.querySelector('.abm-row-computing');
    expect(row.querySelector('.btn-spinner')).toBeInTheDocument();
  });

  it('multi-disc track shows disc prefix in track label', () => {
    const tracks = [{ ...makeTrack(3, 'pending'), disc: 2, track: 3 }];
    renderModal({ tracks });
    expect(screen.getByText('2-03')).toBeInTheDocument();
  });

  it('inner modal click does not propagate to backdrop', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    fireEvent.click(container.querySelector('.modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders "Compute all BPM" header eyebrow', () => {
    renderModal({});
    expect(screen.getByText(/compute all bpm/i)).toBeInTheDocument();
  });

  it('progress bar fill is 0% when total is 0', () => {
    const { container } = renderModal({ progress: { done: 0, total: 0 } });
    const fill = container.querySelector('.abm-progress-fill');
    expect(fill).toHaveStyle({ width: '0%' });
  });
});
