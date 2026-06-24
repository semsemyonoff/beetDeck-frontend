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
