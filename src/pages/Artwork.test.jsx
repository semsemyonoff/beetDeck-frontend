import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import Artwork from './Artwork.jsx';
import { APP_NAME } from '../lib/useDocumentTitle.js';

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

const MBID = '1b022e01-4da6-387b-8658-8678046e4cef';

const ALBUM = {
  id: 1,
  album: 'Dummy',
  albumartist: 'Portishead',
  year: 1994,
  mb_albumid: MBID,
  has_cover: true,
  tagged: true,
  ignored: false,
};

const LISTING = {
  mb_albumid: MBID,
  available: true,
  reason: null,
  storage_enabled: true,
  storage_error: null,
  source: 'storage',
  fetched_at: '2026-08-14T12:00:00Z',
  current_image_id: null,
  images: [],
};

// Both fetches are driven off the URL, so a test can fail exactly one of them
// and keep the other honest.
function makeFetch({
  album = ALBUM,
  listing = LISTING,
  albumStatus = 200,
  listingStatus = 200,
} = {}) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/album/1')
      return Promise.resolve({
        ok: albumStatus < 400,
        status: albumStatus,
        json: async () => album,
      });
    if (String(url).startsWith('/api/album/1/artwork'))
      return Promise.resolve({
        ok: listingStatus < 400,
        status: listingStatus,
        json: async () => listing,
      });
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

async function renderArtwork(opts) {
  const fetchMock = makeFetch(opts);
  vi.stubGlobal('fetch', fetchMock);
  await act(async () => {
    render(<Artwork id="1" />);
  });
  return fetchMock;
}

function artworkCalls(fetchMock) {
  return fetchMock.mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.startsWith('/api/album/1/artwork'));
}

describe('Artwork — shell', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
    document.title = APP_NAME;
  });

  it('shows a loading line until both fetches settle', async () => {
    let resolveListing;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/album/1')
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ALBUM,
          });
        return new Promise((res) => {
          resolveListing = () =>
            res({ ok: true, status: 200, json: async () => LISTING });
        });
      })
    );
    await act(async () => {
      render(<Artwork id="1" />);
    });
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await act(async () => {
      resolveListing();
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    );
    expect(
      screen.getByRole('heading', { name: 'Artwork' })
    ).toBeInTheDocument();
  });

  it.each([
    ['the album request', { albumStatus: 500 }],
    ['the listing request', { listingStatus: 502 }],
  ])('shows an error line when %s fails', async (_label, opts) => {
    await renderArtwork(opts);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load artwork/i)).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('heading', { name: 'Artwork' })
    ).not.toBeInTheDocument();
  });

  it('renders the breadcrumbs as real anchors', async () => {
    await renderArtwork();
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
      'href',
      '#/'
    );
    expect(screen.getByRole('link', { name: 'Portishead' })).toHaveAttribute(
      'href',
      '#/artist/Portishead'
    );
    expect(screen.getByRole('link', { name: 'Dummy' })).toHaveAttribute(
      'href',
      '#/album/1'
    );
  });

  it('renders the current crumb as static text, not a link', async () => {
    await renderArtwork();
    const crumb = document.querySelector('.crumb-static-now');
    expect(crumb).toHaveTextContent('Artwork');
    expect(
      screen.queryByRole('link', { name: 'Artwork' })
    ).not.toBeInTheDocument();
  });

  it('drops the artist crumb when the album has no album artist', async () => {
    await renderArtwork({ album: { ...ALBUM, albumartist: '' } });
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Portishead' })
    ).not.toBeInTheDocument();
  });

  it('renders the header line and a truncated MBID', async () => {
    await renderArtwork();
    const sub = document.querySelector('.page-sub');
    expect(sub).toHaveTextContent('Portishead — Dummy (1994)');
    const mbid = document.querySelector('.art-mbid');
    expect(mbid).toHaveTextContent('1b022e01…');
    // The full id stays reachable rather than being lost to the truncation.
    expect(mbid).toHaveAttribute('title', MBID);
  });

  it('shows the "stored locally" badge when storage is on and healthy', async () => {
    await renderArtwork();
    const badge = document.querySelector('.art-head-side .badge');
    expect(badge).toHaveTextContent('Stored locally');
    expect(badge.className).toContain('badge-ok');
  });

  it('shows the "cache only" badge when storage is off', async () => {
    await renderArtwork({
      listing: { ...LISTING, storage_enabled: false, source: 'cache' },
    });
    const badge = document.querySelector('.art-head-side .badge');
    expect(badge).toHaveTextContent('Cache only');
    expect(badge.className).toContain('badge-warn');
  });

  it('names the failure when storage is configured but unusable', async () => {
    await renderArtwork({
      listing: {
        ...LISTING,
        storage_error: 'permission denied: /data/artwork',
        source: 'cache',
      },
    });
    const badge = document.querySelector('.art-head-side .badge');
    expect(badge).toHaveTextContent('Storage unavailable');
    expect(badge.className).toContain('badge-warn');
    expect(
      screen.getByText(/permission denied: \/data\/artwork/)
    ).toBeInTheDocument();
  });

  it('renders the provenance line from source and fetched_at', async () => {
    await renderArtwork();
    expect(
      screen.getByText('from local storage · fetched 2026-08-14 12:00 UTC')
    ).toBeInTheDocument();
  });

  it('puts the album in the tab title', async () => {
    await renderArtwork();
    expect(document.title).toBe(`Artwork — Dummy — Portishead · ${APP_NAME}`);
  });
});

describe('Artwork — refresh', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
    document.title = APP_NAME;
  });

  it('requests the listing without ?refresh on mount', async () => {
    const fetchMock = await renderArtwork();
    expect(artworkCalls(fetchMock)).toEqual(['/api/album/1/artwork']);
  });

  it('re-requests with ?refresh=1 when Refresh is clicked', async () => {
    const fetchMock = await renderArtwork();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });
    await waitFor(() =>
      expect(artworkCalls(fetchMock)).toEqual([
        '/api/album/1/artwork',
        '/api/album/1/artwork?refresh=1',
      ])
    );
  });

  it('does not re-request the album itself on Refresh', async () => {
    const fetchMock = await renderArtwork();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });
    await waitFor(() => expect(artworkCalls(fetchMock)).toHaveLength(2));
    const albumCalls = fetchMock.mock.calls.filter(
      (c) => String(c[0]) === '/api/album/1'
    );
    expect(albumCalls).toHaveLength(1);
  });
});
