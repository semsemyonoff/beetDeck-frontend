import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import Untagged from './Untagged.jsx';

const ITEMS = [
  {
    id: 1,
    title: 'Track One',
    artist: 'Artist A',
    album: '',
    track: 1,
    album_id: 10,
    path: '/Music/Folder/01.mp3',
  },
  {
    id: 2,
    title: 'Track Two',
    artist: 'Artist A',
    album: '',
    track: 2,
    album_id: 10,
    path: '/Music/Folder/02.mp3',
  },
  {
    id: 3,
    title: 'Other Track',
    artist: 'Artist B',
    album: '',
    track: 1,
    album_id: 20,
    path: '/Other/Dir/01.mp3',
  },
];

const DIR = '/Music/Folder';

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

function makeFetch(
  items = ITEMS,
  batchResult = { status: 'ok', warnings: [] }
) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/items/untagged') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(items) });
    }
    if (url === '/api/items/metadata-batch') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(batchResult),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('Untagged — folder editor', () => {
  let fetchMock;

  beforeEach(() => {
    stubLocation();
    fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  it('renders rows for the matching directory and excludes other dirs', async () => {
    await act(async () => {
      render(<Untagged dir={DIR} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Track One')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Track Two')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Other Track')).not.toBeInTheDocument();
  });

  it('shows folder-not-found when dir does not match any group', async () => {
    await act(async () => {
      render(<Untagged dir="/No/Such/Dir" />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Folder not found')).toBeInTheDocument();
  });

  it('shows load error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );
    await act(async () => {
      render(<Untagged dir={DIR} />);
    });
    await waitFor(() =>
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument()
    );
  });

  it('album-only bulk edit + Save POSTs all row ids with album fields', async () => {
    await act(async () => {
      render(<Untagged dir={DIR} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Select all rows via the header checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // BulkBar is now visible — set Album Artist
    const albumArtistInput = screen.getByLabelText('Album Artist');
    fireEvent.change(albumArtistInput, { target: { value: 'The Artist' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to/i }));

    // Save button should now be enabled (rows are dirty)
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const batchCalls = fetchMock.mock.calls.filter(
        (c) => c[0] === '/api/items/metadata-batch'
      );
      expect(batchCalls).toHaveLength(1);
      const body = JSON.parse(batchCalls[0][1].body);
      // album-level field carried in album object
      expect(body.album).toMatchObject({ albumartist: 'The Artist' });
      // every row id present in items
      expect(body.items).toHaveLength(2);
      expect(body.items.map((i) => i.id)).toEqual(
        expect.arrayContaining([1, 2])
      );
      // no per-item field edits (only albumartist changed, which is not an item field)
      body.items.forEach((item) => {
        expect(Object.keys(item)).toEqual(['id']);
      });
    });
  });

  it('identify button is disabled until both album and album-artist are set', async () => {
    await act(async () => {
      render(<Untagged dir={DIR} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    const identifyBtn = screen.getByRole('button', {
      name: /identify via musicbrainz/i,
    });
    expect(identifyBtn).toBeDisabled();

    // Select all, set only albumartist
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const albumArtistInput = screen.getByLabelText('Album Artist');
    fireEvent.change(albumArtistInput, { target: { value: 'Artist Name' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to/i }));

    // Still disabled (no album set)
    expect(identifyBtn).toBeDisabled();

    // Now also set album in a second BulkBar apply
    const albumInput = screen.getByLabelText('Album');
    fireEvent.change(albumInput, { target: { value: 'Album Name' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to/i }));

    // Now both are set → button enabled
    expect(identifyBtn).not.toBeDisabled();
  });

  it('shows a flash warning when the batch endpoint returns warnings', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(ITEMS, {
        status: 'ok',
        warnings: ['file write failed for id 1'],
      })
    );
    await act(async () => {
      render(<Untagged dir={DIR} />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );

    // Select all and apply albumartist to make rows dirty
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const albumArtistInput = screen.getByLabelText('Album Artist');
    fireEvent.change(albumArtistInput, { target: { value: 'Artist' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to/i }));

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/file write failed for id 1/)).toBeInTheDocument()
    );
  });
});

describe('Untagged — folder index fallback (no dir)', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
  });

  it('shows all folder groups when no dir is given', async () => {
    vi.stubGlobal('fetch', makeFetch());
    await act(async () => {
      render(<Untagged />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    // ITEMS has 2 distinct dirs
    expect(screen.getByText('2 folders need tagging')).toBeInTheDocument();
  });

  it('shows empty state when no untagged items exist', async () => {
    vi.stubGlobal('fetch', makeFetch([]));
    await act(async () => {
      render(<Untagged />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Nothing to clean up')).toBeInTheDocument();
  });
});
