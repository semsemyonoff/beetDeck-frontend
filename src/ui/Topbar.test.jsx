import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
