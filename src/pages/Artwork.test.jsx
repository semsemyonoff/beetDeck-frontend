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

function image(overrides) {
  return {
    image_id: '1',
    types: ['Front'],
    front: true,
    back: false,
    approved: true,
    comment: '',
    thumb_sizes: [250, 500, 1200],
    mb_url: `https://musicbrainz.org/release/${MBID}`,
    width: null,
    height: null,
    ...overrides,
  };
}

const IMAGES = [
  image({ image_id: '100', width: 1425, height: 1425 }),
  image({
    image_id: '200',
    types: ['Back'],
    front: false,
    back: true,
    comment: 'rear sleeve, slight crease',
    thumb_sizes: [250, 500],
  }),
  image({
    image_id: '300',
    types: ['Booklet', 'Front'],
    front: false,
    approved: false,
    width: 2400,
    height: 1200,
  }),
];

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

describe('Artwork — chips and grid', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    restoreLocation();
    document.title = APP_NAME;
  });

  function withImages(images = IMAGES, extra = {}) {
    return renderArtwork({ listing: { ...LISTING, images, ...extra } });
  }

  function tiles() {
    return [...document.querySelectorAll('.art-tile')];
  }

  function chip(name) {
    return [...document.querySelectorAll('.art-chip')].find((b) =>
      b.textContent.startsWith(name)
    );
  }

  it('renders one tile per image, ordered by primary type', async () => {
    await withImages();
    expect(tiles()).toHaveLength(3);
    // sortImages: Front, Back, Booklet — the front cover leads the grid.
    expect(
      tiles().map((t) => t.querySelector('.art-type').textContent)
    ).toEqual(['Front', 'Back', 'Booklet']);
  });

  it('renders every type of an image as its own badge', async () => {
    await withImages();
    const booklet = tiles()[2];
    expect(
      [...booklet.querySelectorAll('.art-type')].map((s) => s.textContent)
    ).toEqual(['Booklet', 'Front']);
    // The class carries the type so the prototype's per-type colours apply.
    expect(booklet.querySelector('.art-type').className).toContain(
      'art-type-booklet'
    );
  });

  it('builds the chips from the types present, with counts', async () => {
    await withImages();
    const labels = [...document.querySelectorAll('.art-chip')].map((b) =>
      b.textContent.replace(/\s+/g, ' ').trim()
    );
    // Front counts twice: an image with two types counts under each, because
    // the chips filter rather than partition.
    expect(labels).toEqual(['All 3', 'Front 2', 'Back 1', 'Booklet 1']);
    expect(chip('All').className).toContain('art-chip-on');
  });

  it('narrows the grid to the active chip', async () => {
    await withImages();
    await act(async () => {
      fireEvent.click(chip('Front'));
    });
    expect(tiles()).toHaveLength(2);
    expect(chip('Front').className).toContain('art-chip-on');
    expect(chip('All').className).not.toContain('art-chip-on');
    expect(
      screen.getByText(/3 images from Cover Art Archive · showing 2 front/)
    ).toBeInTheDocument();
  });

  it('goes back to the full grid when All is clicked', async () => {
    await withImages();
    await act(async () => {
      fireEvent.click(chip('Back'));
    });
    expect(tiles()).toHaveLength(1);
    await act(async () => {
      fireEvent.click(chip('All'));
    });
    expect(tiles()).toHaveLength(3);
  });

  it('falls back to All when a refresh drops the filtered type', async () => {
    // Leaving the active chip pointing at a type that is gone would render an
    // empty grid with no visible cause.
    const fetchMock = makeFetch({
      listing: { ...LISTING, images: IMAGES },
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      render(<Artwork id="1" />);
    });
    await act(async () => {
      fireEvent.click(chip('Back'));
    });
    expect(tiles()).toHaveLength(1);

    fetchMock.mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          url === '/api/album/1' ? ALBUM : { ...LISTING, images: [IMAGES[0]] },
      })
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(chip('All').className).toContain('art-chip-on');
    expect(chip('Back')).toBeUndefined();
  });

  it('flags the tile whose id matches current_image_id', async () => {
    await withImages(IMAGES, { current_image_id: '200' });
    const flagged = tiles().filter((t) =>
      t.className.includes('art-tile-cover')
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveTextContent('Back');
    expect(screen.getAllByText('Current cover')).toHaveLength(1);
  });

  it('flags no tile when the album has no applied CAA cover', async () => {
    await withImages();
    expect(screen.queryByText('Current cover')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.art-tile-cover')).toHaveLength(0);
  });

  it('marks unapproved images and leaves approved ones unmarked', async () => {
    await withImages();
    expect(screen.getAllByText('Not approved')).toHaveLength(1);
    expect(tiles()[2]).toHaveTextContent('Not approved');
  });

  it('renders a comment only when the image carries one', async () => {
    await withImages();
    const comments = [...document.querySelectorAll('.art-comment')].map(
      (c) => c.textContent
    );
    expect(comments).toEqual(['rear sleeve, slight crease']);
  });

  it('shows the measured size, and an em dash when the API has none', async () => {
    await withImages();
    const sizes = tiles().map((t) => t.querySelector('.art-ratio').textContent);
    // 200 has never had its original fetched, so nothing measured it. The 250 px
    // tile in front of you was measured — reporting *that* would be a false fact
    // about the scan.
    expect(sizes).toEqual(['1425×1425', '—', '2400×1200']);
  });

  it('describes each tile image by its types', async () => {
    await withImages();
    expect(
      screen.getByRole('img', { name: 'Booklet, Front artwork' })
    ).toBeInTheDocument();
  });

  it('describes an untyped image without an empty alt', async () => {
    await withImages([image({ image_id: '400', types: [] })]);
    expect(
      screen.getByRole('img', { name: 'Untyped artwork' })
    ).toBeInTheDocument();
  });

  it('loads tiles lazily', async () => {
    await withImages();
    for (const img of screen.getAllByRole('img')) {
      expect(img).toHaveAttribute('loading', 'lazy');
      // The responsive rule in styles.css matches on this class, despite the
      // name — the prototype letterboxed an <svg> in the same box.
      expect(img.className).toContain('art-svg');
    }
  });

  // Architectural, not behavioural: every byte goes through the backend proxy.
  // A later refactor to a direct coverartarchive.org URL would keep the gallery
  // looking identical while making local storage pointless and pulling an
  // external origin into the page — this is the test that stops it.
  it('sources every tile from the backend proxy at the tile size', async () => {
    await withImages();
    expect(
      screen.getAllByRole('img').map((i) => i.getAttribute('src'))
    ).toEqual([
      '/api/album/1/artwork/100?size=250',
      '/api/album/1/artwork/200?size=250',
      '/api/album/1/artwork/300?size=250',
    ]);
  });

  it('asks for the original when CAA generated no thumbnails', async () => {
    await withImages([image({ image_id: '500', thumb_sizes: [] })]);
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/api/album/1/artwork/500?size=full'
    );
  });

  it('renders an empty grid without crashing when there are no images', async () => {
    await withImages([]);
    expect(tiles()).toHaveLength(0);
    expect(
      screen.getByText(/0 images from Cover Art Archive/)
    ).toBeInTheDocument();
    // Only the All chip; there are no types to build the rest from.
    expect(document.querySelectorAll('.art-chip')).toHaveLength(1);
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
