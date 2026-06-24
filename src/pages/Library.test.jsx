import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Library from './Library.jsx';

const LIB_DATA = [
  {
    artist: 'Portishead',
    albums: [
      {
        id: 1,
        album: 'Dummy',
        year: 1994,
        has_cover: false,
        tagged: true,
        ignored: false,
      },
    ],
  },
  {
    artist: 'Massive Attack',
    albums: [
      {
        id: 2,
        album: 'Mezzanine',
        year: 1998,
        has_cover: false,
        tagged: false,
        ignored: false,
      },
    ],
  },
];

function mockFetch(libData = LIB_DATA) {
  return vi.fn().mockImplementation((url) => {
    if (url === '/api/library')
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => libData,
      });
    if (url === '/api/items/untagged')
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

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

async function renderInWallLayout(libData = LIB_DATA) {
  vi.stubGlobal('fetch', mockFetch(libData));
  await act(async () => {
    render(<Library />);
  });
  fireEvent.click(screen.getByRole('button', { name: /wall/i }));
}

async function renderInIndexLayout(libData = LIB_DATA) {
  vi.stubGlobal('fetch', mockFetch(libData));
  await act(async () => {
    render(<Library />);
  });
  // Index is the default layout — no layout switch needed
}

describe('LibraryWall — stretched-link wall cards', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('album link renders as an anchor with correct href', async () => {
    await renderInWallLayout();
    const albumLink = screen.getByText('Dummy').closest('a');
    expect(albumLink).not.toBeNull();
    expect(albumLink).toHaveAttribute('href', '#/album/1');
  });

  it('artist link renders as an anchor with correct href', async () => {
    await renderInWallLayout();
    const artistLink = screen.getByText('Portishead').closest('a');
    expect(artistLink).not.toBeNull();
    expect(artistLink).toHaveAttribute(
      'href',
      '#/artist/' + encodeURIComponent('Portishead')
    );
  });

  it('album link has a non-empty accessible name', async () => {
    await renderInWallLayout();
    const albumLink = screen.getByText('Dummy').closest('a');
    expect(albumLink.textContent.trim()).not.toBe('');
  });

  it('artist link has a non-empty accessible name', async () => {
    await renderInWallLayout();
    const artistLink = screen.getByText('Portishead').closest('a');
    expect(artistLink.textContent.trim()).not.toBe('');
  });

  it('each card has two focusable anchors (album + artist)', async () => {
    await renderInWallLayout();
    const albumLinks = document.querySelectorAll('a.wall-card-link');
    const artistLinks = document.querySelectorAll('a.wall-card-artist');
    expect(albumLinks.length).toBe(LIB_DATA.length);
    expect(artistLinks.length).toBe(LIB_DATA.length);
    albumLinks.forEach((el) => expect(el).toHaveAttribute('href'));
    artistLinks.forEach((el) => expect(el).toHaveAttribute('href'));
  });

  it('clicking artist link navigates to the artist (not the album)', async () => {
    await renderInWallLayout();
    const artistLink = screen.getByText('Portishead').closest('a');
    fireEvent.click(artistLink);
    expect(window.location.hash).toBe(
      '#/artist/' + encodeURIComponent('Portishead')
    );
  });

  it('clicking album link navigates to the album', async () => {
    await renderInWallLayout();
    const albumLink = screen.getByText('Dummy').closest('a');
    fireEvent.click(albumLink);
    expect(window.location.hash).toBe('#/album/1');
  });

  it('Cmd+click on album link does not navigate (browser opens new tab)', async () => {
    await renderInWallLayout();
    const albumLink = screen.getByText('Dummy').closest('a');
    fireEvent.click(albumLink, { button: 0, metaKey: true });
    expect(window.location.hash).toBe('');
  });

  it('Cmd+click on artist link does not navigate (browser opens new tab)', async () => {
    await renderInWallLayout();
    const artistLink = screen.getByText('Portishead').closest('a');
    fireEvent.click(artistLink, { button: 0, metaKey: true });
    expect(window.location.hash).toBe('');
  });

  it('needs-review badge renders for unidentified album', async () => {
    await renderInWallLayout();
    const badge = document.querySelector('.wall-card-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('needs review');
  });

  it('second card album and artist links have correct hrefs', async () => {
    await renderInWallLayout();
    const albumLink = screen.getByText('Mezzanine').closest('a');
    expect(albumLink).toHaveAttribute('href', '#/album/2');
    const artistLink = screen.getByText('Massive Attack').closest('a');
    expect(artistLink).toHaveAttribute(
      'href',
      '#/artist/' + encodeURIComponent('Massive Attack')
    );
  });
});

describe('LibraryIndex — list view', () => {
  beforeEach(stubLocation);
  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('artist name renders as an anchor with correct href', async () => {
    await renderInIndexLayout();
    const artistLinks = screen.getAllByRole('link', { name: 'Portishead' });
    expect(artistLinks.length).toBeGreaterThan(0);
    expect(artistLinks[0]).toHaveAttribute(
      'href',
      '#/artist/' + encodeURIComponent('Portishead')
    );
  });

  it('artist link has a non-empty accessible name', async () => {
    await renderInIndexLayout();
    const link = screen.getAllByRole('link', { name: 'Portishead' })[0];
    expect(link.textContent.trim()).not.toBe('');
  });

  it('clicking artist link navigates to the artist', async () => {
    await renderInIndexLayout();
    const link = screen.getAllByRole('link', { name: 'Portishead' })[0];
    fireEvent.click(link);
    expect(window.location.hash).toBe(
      '#/artist/' + encodeURIComponent('Portishead')
    );
  });

  it('toggle button has aria-label, aria-expanded=false, and aria-controls', async () => {
    await renderInIndexLayout();
    const btn = screen.getByRole('button', {
      name: /toggle albums for portishead/i,
    });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    const albumsId = btn.getAttribute('aria-controls');
    expect(albumsId).toBeTruthy();
  });

  it('clicking toggle button flips aria-expanded and reveals album chips', async () => {
    await renderInIndexLayout();
    const btn = screen.getByRole('button', {
      name: /toggle albums for portishead/i,
    });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const albumsContainer = document.getElementById(
      btn.getAttribute('aria-controls')
    );
    expect(albumsContainer).not.toBeNull();
  });

  it('album chip renders as an anchor with correct href after expanding', async () => {
    await renderInIndexLayout();
    const btn = screen.getByRole('button', {
      name: /toggle albums for portishead/i,
    });
    fireEvent.click(btn);
    const chipLink = screen.getByRole('link', { name: /dummy/i });
    expect(chipLink).toHaveAttribute('href', '#/album/1');
  });

  it('clicking album chip navigates to the album', async () => {
    await renderInIndexLayout();
    const btn = screen.getByRole('button', {
      name: /toggle albums for portishead/i,
    });
    fireEvent.click(btn);
    const chipLink = screen.getByRole('link', { name: /dummy/i });
    fireEvent.click(chipLink);
    expect(window.location.hash).toBe('#/album/1');
  });

  it('Cmd+click on artist link does not navigate (browser opens new tab)', async () => {
    await renderInIndexLayout();
    const link = screen.getAllByRole('link', { name: 'Portishead' })[0];
    fireEvent.click(link, { button: 0, metaKey: true });
    expect(window.location.hash).toBe('');
  });

  it('aria-controls points to the albums container id', async () => {
    await renderInIndexLayout();
    const btn = screen.getByRole('button', {
      name: /toggle albums for portishead/i,
    });
    fireEvent.click(btn);
    const albumsId = btn.getAttribute('aria-controls');
    const container = document.getElementById(albumsId);
    expect(container).not.toBeNull();
    expect(container.classList.contains('lib-row-albums')).toBe(true);
  });
});
