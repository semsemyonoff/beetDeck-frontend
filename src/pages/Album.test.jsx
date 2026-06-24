import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import Album from './Album.jsx';

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

function makeFetch(data = ALBUM_DATA) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/album/42') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('Album — breadcrumb navigation', () => {
  beforeEach(() => {
    stubLocation();
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
