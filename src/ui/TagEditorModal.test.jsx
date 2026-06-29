import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import TagEditorModal from './TagEditorModal.jsx';

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

const ALBUM = {
  id: 10,
  album: 'Test Album',
  albumartist: 'Test Artist',
  year: 2021,
  genre: 'Rock',
  path: '/music/Test Artist/Test Album',
  tracks: [
    {
      id: 1,
      title: 'First Track',
      artist: 'Test Artist',
      track: 1,
      format: 'mp3',
    },
    {
      id: 2,
      title: 'Second Track',
      artist: 'Test Artist',
      track: 2,
      format: 'mp3',
    },
  ],
};

describe('TagEditorModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders track titles from album data', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );
    expect(screen.getByDisplayValue('First Track')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Second Track')).toBeInTheDocument();
  });

  it('shows album and artist in the modal heading', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Test Album');
    expect(heading).toHaveTextContent('Test Artist');
  });

  it('Write button is disabled when no edits made', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );
    const writeBtn = screen.getByRole('button', { name: /write/i });
    expect(writeBtn).toBeDisabled();
  });

  it('editing a cell enables Write and issues metadata-batch POST with all ids', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ status: 'ok', warnings: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();

    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={onSaved} />
    );

    const titleInput = screen.getByDisplayValue('First Track');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    const writeBtn = screen.getByRole('button', { name: /write/i });
    expect(writeBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(writeBtn);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/items/metadata-batch');
    const body = JSON.parse(init.body);
    // all track ids present in items
    expect(body.items.map((i) => i.id)).toEqual([1, 2]);
    // the edited track carries the new title
    expect(body.items.find((i) => i.id === 1).title).toBe('New Title');
    // album-level fields are sent
    expect(body.album.album).toBe('Test Album');
    expect(body.album.albumartist).toBe('Test Artist');
    expect(onSaved).toHaveBeenCalledOnce();
    // No warnings → onSaved is told so, so the parent reports plain success.
    expect(onSaved.mock.calls[0][0]).toEqual({ warnings: [] });
  });

  it('shows flash warning when backend returns warnings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok({ status: 'ok', warnings: ['item 99 not found'] })
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByDisplayValue('First Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /write/i }));
    });

    expect(screen.getByText(/item 99 not found/i)).toBeInTheDocument();
  });

  it('passes backend warnings to onSaved so the parent can qualify success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok({ status: 'ok', warnings: ['file write failed: /x.mp3'] })
      );
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();

    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={onSaved} />
    );

    fireEvent.change(screen.getByDisplayValue('First Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /write/i }));
    });

    expect(onSaved).toHaveBeenCalledOnce();
    expect(onSaved.mock.calls[0][0]).toEqual({
      warnings: ['file write failed: /x.mp3'],
    });
  });

  it('shows error flash when POST fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByDisplayValue('First Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /write/i }));
    });

    expect(screen.getByText(/bad request/i)).toBeInTheDocument();
  });

  it('refreshes the album-grid row after a per-track free-tag save', async () => {
    const TRACK_TAGS = { title: 'First Track', artist: 'Test Artist' };
    const CATALOG = [
      { name: 'title', type: 'str', editable: true, album_level: false },
      { name: 'artist', type: 'str', editable: true, album_level: false },
    ];
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      if (init?.method === 'PATCH')
        return Promise.resolve(ok({ status: 'ok', warnings: [] }));
      if (String(url).includes('/items/fields'))
        return Promise.resolve(ok(CATALOG));
      if (String(url).includes('/tags')) return Promise.resolve(ok(TRACK_TAGS));
      return Promise.resolve(ok({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TagEditorModal album={ALBUM} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    // Open the per-track free-tag editor for the first track.
    fireEvent.click(screen.getAllByRole('button', { name: 'все' })[0]);

    // The editor loads the track's own tags → a second 'First Track' input.
    await waitFor(() =>
      expect(screen.getAllByDisplayValue('First Track')).toHaveLength(2)
    );

    // Edit the title inside the per-track editor (the later input) and save.
    const titleInputs = screen.getAllByDisplayValue('First Track');
    fireEvent.change(titleInputs[titleInputs.length - 1], {
      target: { value: 'Refreshed Title' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    // Editor closed; the album-grid row now reflects the persisted value, so a
    // later batch write will not overwrite it with the stale title.
    expect(screen.getByDisplayValue('Refreshed Title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('First Track')).not.toBeInTheDocument();
  });

  it('shows focus note when focusTrack is set', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <TagEditorModal
        album={ALBUM}
        focusTrack={2}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByText(/opened from: second track/i)).toBeInTheDocument();
  });

  it('Escape calls onClose', () => {
    vi.stubGlobal('fetch', vi.fn());
    const onClose = vi.fn();
    render(
      <TagEditorModal album={ALBUM} onClose={onClose} onSaved={vi.fn()} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop click calls onClose', () => {
    vi.stubGlobal('fetch', vi.fn());
    const onClose = vi.fn();
    render(
      <TagEditorModal album={ALBUM} onClose={onClose} onSaved={vi.fn()} />
    );
    fireEvent.click(document.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Cancel button calls onClose', () => {
    vi.stubGlobal('fetch', vi.fn());
    const onClose = vi.fn();
    render(
      <TagEditorModal album={ALBUM} onClose={onClose} onSaved={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
