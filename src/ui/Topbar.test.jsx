import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Topbar from './Topbar.jsx';
import { searchShortcut } from '../lib/platform.js';

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

// The Topbar computes the shortcut from the real (jsdom) navigator at module
// load, so derive the expected label/modifier from the same source instead of
// hard-coding a platform.
const SHORTCUT = searchShortcut();

function stubMatchMedia(matches = false) {
  const mql = {
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql)
  );
}

function renderTopbar(props = {}) {
  return render(
    <Topbar
      onScanStart={() => {}}
      version={{ beetdeck: '0.0.0', beets: '2.10.0' }}
      {...props}
    />
  );
}

// Build a keydown event for the active combo (the one that should match) or the
// wrong primary modifier (the one that must not).
function shortcutKeyEvent({ active }) {
  const useMeta = active ? SHORTCUT.mac : !SHORTCUT.mac;
  return new KeyboardEvent('keydown', {
    key: 'k',
    metaKey: useMeta,
    ctrlKey: !useMeta,
    bubbles: true,
    cancelable: true,
  });
}

describe('Topbar brand link', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('renders the brand as a link with href="#/"', () => {
    renderTopbar();
    const brand = screen.getByRole('link', { name: /beetDeck/i });
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveAttribute('href', '#/');
  });

  it('plain click on brand navigates to library and closes search', () => {
    renderTopbar();
    const brand = screen.getByRole('link', { name: /beetDeck/i });
    fireEvent.click(brand);
    expect(window.location.hash).toBe('');
  });

  it('Cmd+click on brand does not navigate (browser opens new tab)', () => {
    renderTopbar();
    window.location.hash = '#/album/1';
    const brand = screen.getByRole('link', { name: /beetDeck/i });
    fireEvent.click(brand, { button: 0, metaKey: true });
    expect(window.location.hash).toBe('#/album/1');
  });
});

describe('Topbar version', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('links each version number to its release notes, opening in a new tab', () => {
    renderTopbar({
      version: {
        beetdeck: '0.2.0',
        beets: '2.12.0',
        beetdeck_url:
          'https://github.com/semsemyonoff/beetDeck/releases/tag/v0.2.0',
        beets_url: 'https://github.com/beetbox/beets/releases/tag/v2.12.0',
      },
    });
    const app = screen.getByRole('link', { name: '0.2.0' });
    expect(app).toHaveAttribute(
      'href',
      'https://github.com/semsemyonoff/beetDeck/releases/tag/v0.2.0'
    );
    expect(app).toHaveAttribute('target', '_blank');
    expect(app).toHaveAttribute('rel', 'noopener noreferrer');

    const beets = screen.getByRole('link', { name: '2.12.0' });
    expect(beets).toHaveAttribute(
      'href',
      'https://github.com/beetbox/beets/releases/tag/v2.12.0'
    );
  });

  it('renders a version number as plain text when its URL is absent', () => {
    // Dev build: beetdeck_url is null, so 0.0.0 must not become a link.
    renderTopbar({
      version: {
        beetdeck: '0.0.0',
        beets: '2.12.0',
        beetdeck_url: null,
        beets_url: 'https://github.com/beetbox/beets/releases/tag/v2.12.0',
      },
    });
    expect(screen.queryByRole('link', { name: '0.0.0' })).toBeNull();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2.12.0' })).toBeInTheDocument();
  });
});

describe('Topbar search hotkey', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreLocation();
  });

  it('renders the OS-aware keycap hint', () => {
    renderTopbar();
    expect(screen.getByText(SHORTCUT.label)).toBeInTheDocument();
  });

  it('focuses + selects the search input and cancels the default on the active combo', () => {
    renderTopbar();
    const input = screen.getByPlaceholderText(/Search artists/i);
    expect(document.activeElement).not.toBe(input);

    const event = shortcutKeyEvent({ active: true });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(prevented).toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('ignores the wrong primary modifier', () => {
    renderTopbar();
    const input = screen.getByPlaceholderText(/Search artists/i);

    const event = shortcutKeyEvent({ active: false });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(prevented).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  it('clears the query on Escape', () => {
    renderTopbar();
    const input = screen.getByPlaceholderText(/Search artists/i);
    fireEvent.change(input, { target: { value: 'radiohead' } });
    expect(input.value).toBe('radiohead');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });
});

describe('Topbar search results', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
    stubLocation();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restoreLocation();
  });

  async function showResults(results) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => results,
      })
    );
    renderTopbar();
    const input = screen.getByPlaceholderText(/Search artists/i);
    fireEvent.change(input, { target: { value: 'radio' } });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {});
  }

  it('renders artist result as anchor with correct href', async () => {
    await showResults({ artists: ['Radiohead'], albums: [], tracks: [] });
    const link = screen.getByRole('link', { name: 'Radiohead' });
    expect(link).toHaveAttribute('href', '#/artist/Radiohead');
  });

  it('renders album result as anchor with correct href', async () => {
    await showResults({
      artists: [],
      albums: [{ id: 5, album: 'OK Computer', albumartist: 'Radiohead' }],
      tracks: [],
    });
    const link = screen.getByRole('link', { name: /OK Computer/i });
    expect(link).toHaveAttribute('href', '#/album/5');
  });

  it('renders track result as anchor with href pointing to its album', async () => {
    await showResults({
      artists: [],
      albums: [],
      tracks: [
        {
          id: 3,
          title: 'Creep',
          album: 'Pablo Honey',
          albumartist: 'Radiohead',
          album_id: 7,
          has_cover: false,
        },
      ],
    });
    const link = screen.getByRole('link', { name: /Creep/i });
    expect(link).toHaveAttribute('href', '#/album/7');
  });

  it('plain click on artist result closes the search dropdown', async () => {
    await showResults({ artists: ['Radiohead'], albums: [], tracks: [] });
    const link = screen.getByRole('link', { name: 'Radiohead' });
    fireEvent.click(link);
    expect(screen.queryByText('Artists')).not.toBeInTheDocument();
  });

  it('Cmd+click on artist result leaves the dropdown open (new tab on source tab)', async () => {
    await showResults({ artists: ['Radiohead'], albums: [], tracks: [] });
    const link = screen.getByRole('link', { name: 'Radiohead' });
    fireEvent.click(link, { button: 0, metaKey: true });
    expect(screen.getByText('Artists')).toBeInTheDocument();
  });

  it('modified mousedown outside search does not close the dropdown', async () => {
    await showResults({ artists: ['Radiohead'], albums: [], tracks: [] });
    expect(screen.getByRole('link', { name: 'Radiohead' })).toBeInTheDocument();
    const brand = screen.getByRole('link', { name: /beetDeck/i });
    fireEvent.mouseDown(brand, { metaKey: true, button: 0 });
    expect(screen.getByRole('link', { name: 'Radiohead' })).toBeInTheDocument();
  });

  it('plain mousedown outside search closes the dropdown', async () => {
    await showResults({ artists: ['Radiohead'], albums: [], tracks: [] });
    const brand = screen.getByRole('link', { name: /beetDeck/i });
    fireEvent.mouseDown(brand, { button: 0 });
    expect(
      screen.queryByRole('link', { name: 'Radiohead' })
    ).not.toBeInTheDocument();
  });
});
