import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parse, navigate, hrefFor } from './route.js';

describe('parse', () => {
  it('returns library for empty hash', () => {
    expect(parse('')).toEqual({ name: 'library' });
  });

  it('returns library for bare hash', () => {
    expect(parse('#/')).toEqual({ name: 'library' });
    expect(parse('#')).toEqual({ name: 'library' });
  });

  it('returns artist route', () => {
    expect(parse('#/artist/Portishead')).toEqual({
      name: 'artist',
      artist: 'Portishead',
    });
  });

  it('returns album route', () => {
    expect(parse('#/album/42')).toEqual({ name: 'album', id: '42' });
  });

  it('returns bare untagged route', () => {
    expect(parse('#/untagged')).toEqual({ name: 'untagged' });
  });

  it('returns untagged route with decoded dir', () => {
    const dir = '/Music/Loose Bits';
    const encoded = encodeURIComponent(dir);
    expect(parse(`#/untagged/${encoded}`)).toEqual({ name: 'untagged', dir });
  });

  it('falls back to library for unknown routes', () => {
    expect(parse('#/settings')).toEqual({ name: 'library' });
    expect(parse('#/artist')).toEqual({ name: 'library' });
  });

  it('decodes percent-encoded artist name', () => {
    expect(parse('#/artist/foo%20bar')).toEqual({
      name: 'artist',
      artist: 'foo bar',
    });
  });

  it('handles unicode artist names round-trip', () => {
    const name = 'Sigur Rós';
    const encoded = encodeURIComponent(name);
    expect(parse(`#/artist/${encoded}`)).toEqual({
      name: 'artist',
      artist: name,
    });
  });

  it('joins multi-segment artist path', () => {
    expect(parse('#/artist/foo/bar/baz')).toEqual({
      name: 'artist',
      artist: 'foo/bar/baz',
    });
  });

  it('falls back to raw value on malformed percent sequence', () => {
    expect(parse('#/artist/foo%ZZbar')).toEqual({
      name: 'artist',
      artist: 'foo%ZZbar',
    });
  });

  it('falls back to raw value on trailing incomplete percent', () => {
    expect(parse('#/artist/hello%')).toEqual({
      name: 'artist',
      artist: 'hello%',
    });
  });

  it('falls back to raw value on percent followed by one hex digit', () => {
    expect(parse('#/artist/test%2')).toEqual({
      name: 'artist',
      artist: 'test%2',
    });
  });
});

describe('hrefFor', () => {
  it('returns #/ for library target', () => {
    expect(hrefFor({ name: 'library' })).toBe('#/');
  });

  it('returns #/ for null target', () => {
    expect(hrefFor(null)).toBe('#/');
  });

  it('returns encoded artist href', () => {
    expect(hrefFor({ name: 'artist', artist: 'Portishead' })).toBe(
      '#/artist/Portishead'
    );
  });

  it('encodes special chars in artist name', () => {
    expect(hrefFor({ name: 'artist', artist: 'foo bar' })).toBe(
      '#/artist/foo%20bar'
    );
  });

  it('encodes unicode artist name', () => {
    const name = 'Sigur Rós';
    expect(hrefFor({ name: 'artist', artist: name })).toBe(
      '#/artist/' + encodeURIComponent(name)
    );
  });

  it('returns album href', () => {
    expect(hrefFor({ name: 'album', id: '42' })).toBe('#/album/42');
  });

  it('returns bare untagged href', () => {
    expect(hrefFor({ name: 'untagged' })).toBe('#/untagged');
  });

  it('returns untagged href with encoded dir', () => {
    const dir = '/Music/Loose Bits';
    expect(hrefFor({ name: 'untagged', dir })).toBe(
      '#/untagged/' + encodeURIComponent(dir)
    );
  });

  it('parse(hrefFor(t)) round-trips artist', () => {
    const t = { name: 'artist', artist: 'Sigur Rós' };
    expect(parse(hrefFor(t))).toEqual(t);
  });

  it('parse(hrefFor(t)) round-trips album', () => {
    const t = { name: 'album', id: '99' };
    expect(parse(hrefFor(t))).toEqual(t);
  });

  it('parse(hrefFor(t)) round-trips untagged with dir', () => {
    const t = { name: 'untagged', dir: '/Music/Loose Bits' };
    expect(parse(hrefFor(t))).toEqual(t);
  });

  it('parse(#/) equals library', () => {
    expect(parse('#/')).toEqual({ name: 'library' });
  });
});

describe('navigate', () => {
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

  it('clears hash for library', () => {
    navigate({ name: 'library' });
    expect(window.location.hash).toBe('');
  });

  it('clears hash when target is null', () => {
    navigate(null);
    expect(window.location.hash).toBe('');
  });

  it('sets artist hash', () => {
    navigate({ name: 'artist', artist: 'Portishead' });
    expect(window.location.hash).toBe('#/artist/Portishead');
  });

  it('encodes artist name', () => {
    navigate({ name: 'artist', artist: 'foo bar' });
    expect(window.location.hash).toBe('#/artist/foo%20bar');
  });

  it('sets album hash', () => {
    navigate({ name: 'album', id: '99' });
    expect(window.location.hash).toBe('#/album/99');
  });

  it('sets bare untagged hash', () => {
    navigate({ name: 'untagged' });
    expect(window.location.hash).toBe('#/untagged');
  });

  it('sets untagged hash with encoded dir', () => {
    navigate({ name: 'untagged', dir: '/Music/Loose Bits' });
    expect(window.location.hash).toBe(
      '#/untagged/' + encodeURIComponent('/Music/Loose Bits')
    );
  });

  it('artist navigate round-trips through parse', () => {
    const artist = 'Sigur Rós';
    navigate({ name: 'artist', artist });
    expect(parse(window.location.hash)).toEqual({ name: 'artist', artist });
  });

  it('untagged dir with spaces and slashes round-trips through parse', () => {
    const dir = '/Music/Loose Bits';
    navigate({ name: 'untagged', dir });
    expect(parse(window.location.hash)).toEqual({ name: 'untagged', dir });
  });
});
