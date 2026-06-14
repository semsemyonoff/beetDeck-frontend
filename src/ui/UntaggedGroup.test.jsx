import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UntaggedGroup from './UntaggedGroup.jsx';
import Library from '../pages/Library.jsx';

// ── UntaggedGroup unit tests ───────────────────────────────────────────────

const FOLDERS = [
  {
    dir: '/Music/Artist A/Album',
    root: '/Music/Artist A',
    name: 'Album',
    albumId: 1,
    files: [
      {
        id: 10,
        file: '01.mp3',
        title: '',
        artist: '',
        album: '',
        track: '',
        path: '/Music/Artist A/Album/01.mp3',
      },
      {
        id: 11,
        file: '02.mp3',
        title: '',
        artist: '',
        album: '',
        track: '',
        path: '/Music/Artist A/Album/02.mp3',
      },
    ],
  },
  {
    dir: '/Music/Loose',
    root: '/Music',
    name: 'Loose',
    albumId: null,
    files: [
      {
        id: 20,
        file: 'song.mp3',
        title: '',
        artist: '',
        album: '',
        track: '',
        path: '/Music/Loose/song.mp3',
      },
    ],
  },
];

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

describe('UntaggedGroup', () => {
  beforeEach(stubLocation);
  afterEach(restoreLocation);

  it('renders nothing when folders is empty', () => {
    const { container } = render(<UntaggedGroup folders={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when folders is null', () => {
    const { container } = render(<UntaggedGroup folders={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows folder count in the banner title', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    expect(screen.getByText('2 folders need tagging')).toBeInTheDocument();
  });

  it('shows total file count in the banner sub', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    expect(screen.getByText(/3 loose files/i)).toBeInTheDocument();
  });

  it('shows each folder name as a row', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    expect(screen.getByText('Album')).toBeInTheDocument();
    expect(screen.getByText('Loose')).toBeInTheDocument();
  });

  it('shows per-folder file count', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('clicking a folder row navigates to the untagged folder route', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    fireEvent.click(screen.getByText('Loose').closest('button'));
    expect(window.location.hash).toBe(
      '#/untagged/' + encodeURIComponent('/Music/Loose')
    );
  });

  it('clicking a second folder row navigates to its route', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    fireEvent.click(screen.getByText('Album').closest('button'));
    expect(window.location.hash).toBe(
      '#/untagged/' + encodeURIComponent('/Music/Artist A/Album')
    );
  });

  it('starts open and hides rows after toggle click', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    expect(screen.getByText('Loose')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Hide/));
    expect(screen.queryByText('Loose')).not.toBeInTheDocument();
    expect(screen.queryByText('Album')).not.toBeInTheDocument();
  });

  it('shows rows again after a second toggle click', () => {
    render(<UntaggedGroup folders={FOLDERS} />);
    fireEvent.click(screen.getByText(/Hide/));
    fireEvent.click(screen.getByText(/Review/));
    expect(screen.getByText('Loose')).toBeInTheDocument();
  });

  it('single-folder case shows correct counts', () => {
    const single = [FOLDERS[0]];
    render(<UntaggedGroup folders={single} />);
    expect(screen.getByText('1 folders need tagging')).toBeInTheDocument();
    expect(screen.getByText(/2 loose files/i)).toBeInTheDocument();
  });
});

// ── Library integration tests (mocked fetches) ────────────────────────────

const LIB_DATA = [
  {
    artist: 'Unknown Artist',
    albums: [
      {
        id: 99,
        album: 'Unknown Album',
        year: null,
        has_cover: false,
        tagged: false,
        ignored: false,
      },
    ],
  },
  {
    artist: 'Real Artist',
    albums: [
      {
        id: 42,
        album: 'Real Album',
        year: 2020,
        has_cover: false,
        tagged: true,
        ignored: false,
      },
    ],
  },
];

const UNTAGGED_ITEMS = [
  {
    id: 1,
    title: '',
    artist: '',
    album: '',
    path: '/Music/Loose/track.mp3',
    track: 1,
    album_id: 99,
  },
];

function mockFetch(libData, untaggedItems) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/library') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => libData,
      });
    }
    if (url === '/api/items/untagged') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => untaggedItems,
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

describe('Library + UntaggedGroup integration', () => {
  beforeEach(stubLocation);

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('shows banner with folder count after both fetches resolve', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    expect(screen.getByText('1 folders need tagging')).toBeInTheDocument();
  });

  it('shows file count in the banner', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    expect(screen.getByText(/1 loose files/i)).toBeInTheDocument();
  });

  it('excludes the Unknown Artist (whose album is untagged) from the index', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    expect(screen.queryByText('Unknown Artist')).not.toBeInTheDocument();
  });

  it('still shows Real Artist in the index', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    expect(screen.getByText('Real Artist')).toBeInTheDocument();
  });

  it('clicking the folder row navigates to the folder editor route', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    fireEvent.click(screen.getByText('Loose').closest('button'));
    expect(window.location.hash).toBe(
      '#/untagged/' + encodeURIComponent('/Music/Loose')
    );
  });

  it('hides the banner when filter is ident', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, UNTAGGED_ITEMS));
    await act(async () => {
      render(<Library />);
    });
    // Switch to Identified filter
    fireEvent.click(screen.getByRole('button', { name: /identified/i }));
    expect(screen.queryByText(/folders need tagging/i)).not.toBeInTheDocument();
  });

  it('shows no banner when there are no untagged items', async () => {
    vi.stubGlobal('fetch', mockFetch(LIB_DATA, []));
    await act(async () => {
      render(<Library />);
    });
    expect(screen.queryByText(/folders need tagging/i)).not.toBeInTheDocument();
  });
});
