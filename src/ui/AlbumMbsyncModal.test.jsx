import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlbumMbsyncModal from './AlbumMbsyncModal.jsx';

const CHANGED_VM = {
  albumId: 1,
  mbAlbumid: 'release-1',
  dataSource: 'MusicBrainz',
  stashGeneration: 7,
  albumFields: [{ field: 'label', old: '', new: '4AD' }],
  trackFields: [
    {
      field: 'title',
      changes: [
        { itemId: 101, track: 3, old: 'Intro', new: 'Introduction' },
        { itemId: 102, track: null, old: 'Outro', new: 'Ending' },
      ],
    },
  ],
  unmapped: [],
  changed: true,
  fieldNames: ['label', 'title'],
  albumFieldCount: 1,
  trackFieldCount: 1,
  unmappedCount: 0,
};

const NOTHING_TO_UPDATE_VM = {
  albumId: 2,
  mbAlbumid: 'release-2',
  dataSource: 'MusicBrainz',
  stashGeneration: 1,
  albumFields: [],
  trackFields: [],
  unmapped: [],
  changed: false,
  fieldNames: [],
  albumFieldCount: 0,
  trackFieldCount: 0,
  unmappedCount: 0,
};

const UNMAPPED_VM = {
  ...NOTHING_TO_UPDATE_VM,
  albumId: 3,
  unmapped: [
    { itemId: 5, track: 13, title: 'Hidden Track' },
    { itemId: 6, track: null, title: null },
  ],
  unmappedCount: 2,
};

function renderModal(overrides = {}) {
  const defaults = {
    viewModel: CHANGED_VM,
    confirming: false,
    error: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };
  return render(<AlbumMbsyncModal {...defaults} {...overrides} />);
}

describe('AlbumMbsyncModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('diff state', () => {
    it('renders album-level and per-track field groups', () => {
      renderModal();
      expect(screen.getAllByText('label').length).toBeGreaterThan(0);
      expect(screen.getByText('4AD')).toBeInTheDocument();
      expect(screen.getAllByText('title').length).toBeGreaterThan(0);
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Ending')).toBeInTheDocument();
    });

    it('renders empty old value as "empty"', () => {
      renderModal();
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('renders a track with no track number as "—"', () => {
      renderModal();
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders one checkbox per field name, all checked by default', () => {
      renderModal();
      const boxes = screen.getAllByRole('checkbox');
      expect(boxes).toHaveLength(2);
      for (const box of boxes) expect(box).toBeChecked();
    });

    it('Confirm sends no excluded fields when nothing is toggled', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('unchecking a field excludes it from the confirm payload', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });
      fireEvent.click(screen.getByRole('checkbox', { name: /label/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      expect(onConfirm).toHaveBeenCalledWith(['label']);
    });

    it('disables Confirm once every field is excluded', () => {
      renderModal();
      fireEvent.click(screen.getByRole('checkbox', { name: /label/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /title/i }));
      expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    });

    it('re-checking a field re-includes it', () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });
      const labelBox = screen.getByRole('checkbox', { name: /label/i });
      fireEvent.click(labelBox);
      fireEvent.click(labelBox);
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('Confirm is disabled while confirming', () => {
      renderModal({ confirming: true });
      expect(screen.getByRole('button', { name: /writing/i })).toBeDisabled();
    });
  });

  describe('nothing-to-update state', () => {
    it('renders the empty-state message and no field toggles', () => {
      renderModal({ viewModel: NOTHING_TO_UPDATE_VM });
      expect(screen.getByText(/nothing to update/i)).toBeInTheDocument();
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('renders no Confirm button, only Close', () => {
      renderModal({ viewModel: NOTHING_TO_UPDATE_VM });
      expect(
        screen.queryByRole('button', { name: /confirm/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /close/i })
      ).toBeInTheDocument();
    });
  });

  describe('unmapped-tracks state', () => {
    it('lists unmapped tracks with track number and title', () => {
      renderModal({ viewModel: UNMAPPED_VM });
      expect(screen.getByText('13')).toBeInTheDocument();
      expect(screen.getByText('Hidden Track')).toBeInTheDocument();
      expect(
        screen.getAllByText(/not matched to the release, left as is/i)
      ).toHaveLength(2);
    });

    it('falls back to "(untitled)" and "—" for a track missing both', () => {
      renderModal({ viewModel: UNMAPPED_VM });
      expect(screen.getByText('(untitled)')).toBeInTheDocument();
    });

    it('still shows the empty-state message when there are no field changes', () => {
      renderModal({ viewModel: UNMAPPED_VM });
      expect(screen.queryByText(/nothing to update/i)).not.toBeInTheDocument();
    });
  });

  describe('shared behavior', () => {
    it('renders a passed error', () => {
      renderModal({ error: 'the album changed, re-run the preview' });
      expect(
        screen.getByText(/the album changed, re-run the preview/i)
      ).toBeInTheDocument();
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

    it('inner modal click does not propagate to backdrop', () => {
      const onClose = vi.fn();
      const { container } = renderModal({ onClose });
      fireEvent.click(container.querySelector('.modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Cancel calls onClose', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
