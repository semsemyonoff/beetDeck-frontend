import { describe, it, expect } from 'vitest';
import { mapApi, totals, sortArtists, filterArtists, filterAlbums, letterGroups } from './library.js';

const raw = [
  {
    artist: 'Portishead',
    albums: [
      { id: 1, album: 'Dummy', year: 1994, has_cover: true, tagged: true, ignored: false },
      { id: 2, album: 'Third', year: 2008, has_cover: false, tagged: false, ignored: false },
    ],
  },
  {
    artist: 'Massive Attack',
    albums: [
      { id: 3, album: 'Mezzanine', year: 1998, has_cover: true, tagged: false, ignored: true },
    ],
  },
  {
    artist: '808 State',
    albums: [
      { id: 4, album: 'Ex:El', year: 1991, has_cover: false, tagged: false, ignored: false },
    ],
  },
];

describe('mapApi', () => {
  it('returns an artist per entry', () => {
    const artists = mapApi(raw);
    expect(artists).toHaveLength(3);
    expect(artists[0].name).toBe('Portishead');
  });

  it('maps albums correctly', () => {
    const artists = mapApi(raw);
    expect(artists[0].albums[0]).toMatchObject({
      id: 1,
      title: 'Dummy',
      year: 1994,
      identified: true,
    });
  });

  it('handles empty input', () => {
    expect(mapApi([])).toEqual([]);
    expect(mapApi(null)).toEqual([]);
  });
});

describe('totals', () => {
  it('counts artists, albums, ident, notIdent', () => {
    const artists = mapApi(raw);
    const t = totals(artists);
    expect(t.artists).toBe(3);
    expect(t.albums).toBe(4);
    expect(t.ident).toBe(2); // Dummy (tagged) and Mezzanine (ignored)
    expect(t.notIdent).toBe(2); // Third and Ex:El
  });
});

describe('filterArtists', () => {
  const artists = mapApi(raw);

  it('all returns every artist', () => {
    expect(filterArtists(artists, 'all')).toHaveLength(3);
  });

  it('ident keeps artists with at least one identified album', () => {
    const result = filterArtists(artists, 'ident');
    expect(result.map((a) => a.name)).toContain('Portishead');
    expect(result.map((a) => a.name)).toContain('Massive Attack');
    expect(result.map((a) => a.name)).not.toContain('808 State');
  });

  it('noident keeps artists with at least one unidentified album', () => {
    const result = filterArtists(artists, 'noident');
    expect(result.map((a) => a.name)).toContain('Portishead'); // has Third
    expect(result.map((a) => a.name)).not.toContain('Massive Attack'); // all identified
    expect(result.map((a) => a.name)).toContain('808 State');
  });
});

describe('filterAlbums', () => {
  const albums = mapApi(raw)[0].albums; // Dummy (ident) + Third (not ident)

  it('all returns everything', () => {
    expect(filterAlbums(albums, 'all')).toHaveLength(2);
  });

  it('ident returns only identified', () => {
    const result = filterAlbums(albums, 'ident');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Dummy');
  });

  it('noident returns only unidentified', () => {
    const result = filterAlbums(albums, 'noident');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Third');
  });
});

describe('sortArtists', () => {
  const artists = mapApi(raw);

  it('az sorts alphabetically', () => {
    const sorted = sortArtists(artists, 'az');
    expect(sorted[0].name).toBe('808 State');
    expect(sorted[1].name).toBe('Massive Attack');
    expect(sorted[2].name).toBe('Portishead');
  });

  it('size sorts by album count descending', () => {
    const sorted = sortArtists(artists, 'size');
    expect(sorted[0].name).toBe('Portishead'); // 2 albums
  });

  it('recent sorts by most recent album year descending', () => {
    const sorted = sortArtists(artists, 'recent');
    expect(sorted[0].name).toBe('Portishead'); // max year 2008
    expect(sorted[1].name).toBe('Massive Attack'); // 1998
  });

  it('does not mutate the input array', () => {
    const original = [...artists];
    sortArtists(artists, 'az');
    expect(artists.map((a) => a.name)).toEqual(original.map((a) => a.name));
  });
});

describe('letterGroups', () => {
  const artists = mapApi(raw);

  it('groups artists by first letter', () => {
    const sorted = sortArtists(artists, 'az');
    const groups = letterGroups(sorted);
    const letters = groups.map(([l]) => l);
    expect(letters).toContain('8');
    expect(letters).toContain('M');
    expect(letters).toContain('P');
  });

  it('uses # as fallback for empty name', () => {
    const edge = [{ name: '' }];
    const groups = letterGroups(edge);
    expect(groups[0][0]).toBe('#');
  });
});
