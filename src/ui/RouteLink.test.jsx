import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RouteLink from './RouteLink.jsx';
import { hrefFor } from '../lib/route.js';
import { isModifiedClick } from '../useHashRoute.js';

const albumTarget = { name: 'album', id: '42' };
const artistTarget = { name: 'artist', artist: 'Sigur Rós' };

describe('isModifiedClick', () => {
  it('returns false for a plain left-click', () => {
    expect(isModifiedClick({ button: 0 })).toBe(false);
  });

  it('returns true for middle-click', () => {
    expect(isModifiedClick({ button: 1 })).toBe(true);
  });

  it('returns true for right-click', () => {
    expect(isModifiedClick({ button: 2 })).toBe(true);
  });

  it('returns true when metaKey is held', () => {
    expect(isModifiedClick({ button: 0, metaKey: true })).toBe(true);
  });

  it('returns true when ctrlKey is held', () => {
    expect(isModifiedClick({ button: 0, ctrlKey: true })).toBe(true);
  });

  it('returns true when shiftKey is held', () => {
    expect(isModifiedClick({ button: 0, shiftKey: true })).toBe(true);
  });

  it('returns true when altKey is held', () => {
    expect(isModifiedClick({ button: 0, altKey: true })).toBe(true);
  });
});

describe('RouteLink', () => {
  const origLocation = Object.getOwnPropertyDescriptor(window, 'location');

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (origLocation) Object.defineProperty(window, 'location', origLocation);
  });

  it('renders an anchor with correct href for album target', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    expect(link).toHaveAttribute('href', '#/album/42');
  });

  it('href equals hrefFor(target) for artist target with special chars', () => {
    render(<RouteLink target={artistTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    expect(link).toHaveAttribute('href', hrefFor(artistTarget));
  });

  it('renders an anchor tag', () => {
    render(<RouteLink target={albumTarget}>Link Text</RouteLink>);
    const link = screen.getByRole('link', { name: 'Link Text' });
    expect(link.tagName.toLowerCase()).toBe('a');
  });

  it('plain left-click calls preventDefault', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    const notPrevented = fireEvent.click(link, { button: 0 });
    expect(notPrevented).toBe(false);
  });

  it('plain left-click navigates (changes hash)', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0 });
    expect(window.location.hash).toBe('#/album/42');
  });

  it('meta+click does not prevent default', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    const notPrevented = fireEvent.click(link, { button: 0, metaKey: true });
    expect(notPrevented).toBe(true);
  });

  it('meta+click does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0, metaKey: true });
    expect(window.location.hash).toBe('');
  });

  it('ctrl+click does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0, ctrlKey: true });
    expect(window.location.hash).toBe('');
  });

  it('shift+click does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0, shiftKey: true });
    expect(window.location.hash).toBe('');
  });

  it('alt+click does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0, altKey: true });
    expect(window.location.hash).toBe('');
  });

  it('middle-click (button=1) does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 1 });
    expect(window.location.hash).toBe('');
  });

  it('right-click (button=2) does not navigate', () => {
    render(<RouteLink target={albumTarget}>Test</RouteLink>);
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 2 });
    expect(window.location.hash).toBe('');
  });

  it('caller onClick fires on plain click', () => {
    const callerOnClick = vi.fn();
    render(
      <RouteLink target={albumTarget} onClick={callerOnClick}>
        Test
      </RouteLink>
    );
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0 });
    expect(callerOnClick).toHaveBeenCalledOnce();
  });

  it('caller onClick fires before navigation', () => {
    const callerOnClick = vi.fn();
    // Track when hash changes to verify caller fires first
    let callerCalledBeforeNavigate = false;
    const callerOnClickWithCheck = (e) => {
      callerCalledBeforeNavigate = window.location.hash === '';
      callerOnClick(e);
    };
    render(
      <RouteLink target={albumTarget} onClick={callerOnClickWithCheck}>
        Test
      </RouteLink>
    );
    const link = screen.getByRole('link', { name: 'Test' });
    fireEvent.click(link, { button: 0 });
    expect(callerCalledBeforeNavigate).toBe(true);
    expect(window.location.hash).toBe('#/album/42');
  });

  it('passes className to the anchor', () => {
    render(
      <RouteLink target={albumTarget} className="my-class">
        Test
      </RouteLink>
    );
    expect(screen.getByRole('link', { name: 'Test' })).toHaveClass('my-class');
  });

  it('passes extra props to the anchor', () => {
    render(
      <RouteLink target={albumTarget} data-testid="test-link">
        Test
      </RouteLink>
    );
    expect(screen.getByTestId('test-link').tagName.toLowerCase()).toBe('a');
  });
});
