import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import Artist from './Artist.jsx';

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

const ARTIST_DATA = {
  albums: [
    {
      id: 1,
      album: 'Dummy Album',
      albumartist: 'Test Artist',
      year: 2020,
      has_cover: false,
      tagged: true,
      ignored: false,
      genres: [],
    },
  ],
};

function makeFetch(data = ARTIST_DATA) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

describe('Artist — breadcrumb navigation', () => {
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
      render(<Artist name="Test Artist" />);
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    const link = screen.getByRole('link', { name: /library/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#/');
  });
});
