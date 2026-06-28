import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import ItemTagsEditor from './ItemTagsEditor.jsx';

const ITEM = { id: 7, title: 'My Track' };
const ALBUM_ID = 3;

const TAGS = { title: 'My Track', artist: 'Some Artist', length: 240.5 };
const CATALOG = [
  { name: 'title', type: 'str', editable: true, album_level: false },
  { name: 'artist', type: 'str', editable: true, album_level: false },
  { name: 'album', type: 'str', editable: true, album_level: true },
  { name: 'length', type: 'float', editable: false, album_level: false },
  { name: 'comment', type: 'str', editable: true, album_level: false },
];

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

function mockFetch(tagsResp, fieldsResp) {
  return vi.fn().mockImplementation((url) => {
    if (String(url).includes('/tags')) return Promise.resolve(ok(tagsResp));
    if (String(url).includes('/fields')) return Promise.resolve(ok(fieldsResp));
    return Promise.resolve(ok({}));
  });
}

describe('ItemTagsEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders track title in modal heading', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
        'My Track'
      )
    );
  });

  it('renders editable fields as inputs', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Some Artist')).toBeInTheDocument();
  });

  it('renders read-only fields as text (no input)', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    // length is read-only — should NOT have an input with that value
    const inputs = screen.queryAllByDisplayValue('240.5');
    expect(inputs).toHaveLength(0);
    // Should appear as a text node instead
    expect(screen.getByText('240.5')).toBeInTheDocument();
  });

  it('renders album-level warning icon for album-level fields', async () => {
    const tagsWithAlbum = { ...TAGS, album: 'Some Album' };
    vi.stubGlobal('fetch', mockFetch(tagsWithAlbum, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('Some Album')).toBeInTheDocument()
    );
    // album row should have the warning tooltip
    const warnSpan = document.querySelector('[title*="may split the album"]');
    expect(warnSpan).toBeInTheDocument();
  });

  it('Save button is disabled when no changes made', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save button enables after editing a field', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByDisplayValue('My Track'), {
      target: { value: 'New Title' },
    });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('PATCH body equals delta (only changed fields)', async () => {
    const patchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ status: 'ok', warnings: [] }));
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/tags') && !String(url).includes('/fields'))
        return Promise.resolve(ok(TAGS));
      if (String(url).includes('/fields')) return Promise.resolve(ok(CATALOG));
      return patchMock(url);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByDisplayValue('My Track'), {
      target: { value: 'New Title' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    // Find the PATCH call
    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PATCH'
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(patchCall[1].body);
    expect(body).toEqual({ fields: { title: 'New Title' } });
    // Only changed field in delta — artist unchanged so excluded
    expect(body.fields.artist).toBeUndefined();
  });

  it('closes and calls onSaved on success with no warnings', async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/fields')) return Promise.resolve(ok(CATALOG));
      if (String(url).includes('/tags') && !String(url).includes('PATCH'))
        return Promise.resolve(ok(TAGS));
      return Promise.resolve(ok({ status: 'ok', warnings: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByDisplayValue('My Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows warnings non-blockingly and does not auto-close', async () => {
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      if (init?.method === 'PATCH')
        return Promise.resolve(
          ok({ status: 'ok', warnings: ['file write failed: /x.mp3'] })
        );
      if (String(url).includes('/fields')) return Promise.resolve(ok(CATALOG));
      return Promise.resolve(ok(TAGS));
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByDisplayValue('My Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    // Warning is shown
    expect(screen.getByText(/file write failed/i)).toBeInTheDocument();
    // onSaved called (DB write succeeded)
    expect(onSaved).toHaveBeenCalledOnce();
    // modal stays open (no auto-close)
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows error when PATCH returns non-ok status', async () => {
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      if (init?.method === 'PATCH')
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'field not editable: length' }),
        });
      if (String(url).includes('/fields')) return Promise.resolve(ok(CATALOG));
      return Promise.resolve(ok(TAGS));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByDisplayValue('My Track'), {
      target: { value: 'Changed' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(screen.getByText(/field not editable/i)).toBeInTheDocument();
  });

  it('dropdown filters fields by search term, excludes present and read-only', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );

    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }));

    // 'comment' is in catalog, editable, not in current tags — should appear
    expect(screen.getByText('comment')).toBeInTheDocument();
    // 'title' is already present — should NOT appear
    expect(screen.queryAllByRole('button', { name: /^title$/ })).toHaveLength(
      0
    );
    // 'length' is read-only — should NOT appear
    const lengthBtns = screen
      .queryAllByRole('button')
      .filter((b) => b.textContent?.trim() === 'length');
    expect(lengthBtns).toHaveLength(0);

    // Type a search term to filter
    fireEvent.change(screen.getByPlaceholderText(/search fields/i), {
      target: { value: 'com' },
    });
    expect(screen.getByText('comment')).toBeInTheDocument();
    // 'album' doesn't match 'com'
    expect(
      screen
        .queryAllByRole('button')
        .filter((b) => b.textContent?.trim() === 'album')
    ).toHaveLength(0);
  });

  it('selecting a dropdown item adds an editable row', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /add tag/i }));
    const commentBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'comment');
    expect(commentBtn).toBeTruthy();
    fireEvent.click(commentBtn);

    // An empty input for 'comment' should now appear
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
  });

  it('Escape calls onClose', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    const onClose = vi.fn();
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop click calls onClose', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    const onClose = vi.fn();
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.click(document.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Cancel button calls onClose', async () => {
    vi.stubGlobal('fetch', mockFetch(TAGS, CATALOG));
    const onClose = vi.fn();
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue('My Track')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error message when tag fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (String(url).includes('/fields'))
          return Promise.resolve(ok(CATALOG));
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        });
      })
    );
    render(
      <ItemTagsEditor
        albumId={ALBUM_ID}
        item={ITEM}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/failed to load tags/i)).toBeInTheDocument()
    );
  });
});
