import { describe, it, expect } from 'vitest';
import { mergeRows, delta, addableFields } from './itemTags.js';

const CATALOG = [
  { name: 'title', type: 'str', editable: true, album_level: false },
  { name: 'artist', type: 'str', editable: true, album_level: false },
  { name: 'album', type: 'str', editable: true, album_level: true },
  { name: 'year', type: 'int', editable: true, album_level: true },
  { name: 'genres', type: 'list', editable: true, album_level: true },
  { name: 'track', type: 'int', editable: true, album_level: false },
  { name: 'length', type: 'float', editable: false, album_level: false },
  { name: 'mb_trackid', type: 'str', editable: false, album_level: false },
];

const TAGS = {
  title: 'Song Title',
  artist: 'Some Artist',
  album: 'Some Album',
  year: 2022,
  genres: 'Rock\x00Pop',
  length: 240.5,
};

describe('mergeRows', () => {
  it('marks catalog-present editable fields as editable', () => {
    const rows = mergeRows(TAGS, CATALOG);
    const title = rows.find((r) => r.name === 'title');
    expect(title).toBeDefined();
    expect(title.editable).toBe(true);
    expect(title.present).toBe(true);
  });

  it('marks read-only catalog fields as not editable', () => {
    const rows = mergeRows(TAGS, CATALOG);
    const length = rows.find((r) => r.name === 'length');
    expect(length).toBeDefined();
    expect(length.editable).toBe(false);
  });

  it('marks album-level fields correctly', () => {
    const rows = mergeRows(TAGS, CATALOG);
    const album = rows.find((r) => r.name === 'album');
    expect(album.album_level).toBe(true);
    const title = rows.find((r) => r.name === 'title');
    expect(title.album_level).toBe(false);
  });

  it('normalizes list-typed genres with \\x00 delimiter to comma-separated', () => {
    const rows = mergeRows(TAGS, CATALOG);
    const genres = rows.find((r) => r.name === 'genres');
    expect(genres.value).toBe('Rock, Pop');
  });

  it('normalizes list-typed genres with comma delimiter', () => {
    const rows = mergeRows({ genres: 'Rock,Pop,Jazz' }, CATALOG);
    const genres = rows.find((r) => r.name === 'genres');
    expect(genres.value).toBe('Rock, Pop, Jazz');
  });

  it('normalizes numeric values to strings', () => {
    const rows = mergeRows(TAGS, CATALOG);
    const year = rows.find((r) => r.name === 'year');
    expect(year.value).toBe('2022');
  });

  it('converts null value to empty string', () => {
    const rows = mergeRows({ title: null }, CATALOG);
    const title = rows.find((r) => r.name === 'title');
    expect(title.value).toBe('');
  });

  it('catalog-ordered fields come before extra unknown keys', () => {
    const tags = { title: 'T', custom_flex: 'x' };
    const rows = mergeRows(tags, CATALOG);
    const titleIdx = rows.findIndex((r) => r.name === 'title');
    const flexIdx = rows.findIndex((r) => r.name === 'custom_flex');
    expect(titleIdx).toBeLessThan(flexIdx);
  });

  it('treats unknown keys (flexible attrs) as editable by default', () => {
    const tags = { custom_flex: 'value' };
    const rows = mergeRows(tags, CATALOG);
    const flex = rows.find((r) => r.name === 'custom_flex');
    expect(flex).toBeDefined();
    expect(flex.editable).toBe(true);
    expect(flex.album_level).toBe(false);
    expect(flex.present).toBe(true);
  });

  it('omits catalog fields not present in tags', () => {
    const rows = mergeRows({ title: 'T' }, CATALOG);
    expect(rows.find((r) => r.name === 'track')).toBeUndefined();
  });

  it('returns empty array for empty tags', () => {
    expect(mergeRows({}, CATALOG)).toEqual([]);
    expect(mergeRows(null, CATALOG)).toEqual([]);
  });

  it('returns rows with empty string for empty list field', () => {
    const rows = mergeRows({ genres: '' }, CATALOG);
    const genres = rows.find((r) => r.name === 'genres');
    expect(genres.value).toBe('');
  });
});

describe('delta', () => {
  it('returns empty object when nothing changed', () => {
    const orig = [
      { name: 'title', value: 'T' },
      { name: 'artist', value: 'A' },
    ];
    const rows = [
      { name: 'title', value: 'T' },
      { name: 'artist', value: 'A' },
    ];
    expect(delta(rows, orig)).toEqual({});
  });

  it('returns only the changed field', () => {
    const orig = [
      { name: 'title', value: 'Old' },
      { name: 'artist', value: 'A' },
    ];
    const rows = [
      { name: 'title', value: 'New' },
      { name: 'artist', value: 'A' },
    ];
    expect(delta(rows, orig)).toEqual({ title: 'New' });
  });

  it('includes newly added fields not in orig', () => {
    const orig = [{ name: 'title', value: 'T' }];
    const rows = [
      { name: 'title', value: 'T' },
      { name: 'comment', value: 'added' },
    ];
    expect(delta(rows, orig)).toEqual({ comment: 'added' });
  });

  it('includes a cleared field (value set to empty string)', () => {
    const orig = [{ name: 'title', value: 'T' }];
    const rows = [{ name: 'title', value: '' }];
    expect(delta(rows, orig)).toEqual({ title: '' });
  });

  it('does not include fields removed from rows (only tracks present rows)', () => {
    const orig = [
      { name: 'title', value: 'T' },
      { name: 'artist', value: 'A' },
    ];
    const rows = [{ name: 'title', value: 'T' }];
    expect(delta(rows, orig)).toEqual({});
  });

  it('handles empty inputs', () => {
    expect(delta([], [])).toEqual({});
    expect(delta(null, null)).toEqual({});
  });
});

describe('addableFields', () => {
  it('returns editable catalog fields not already in rows', () => {
    const rows = [{ name: 'title' }, { name: 'artist' }];
    const addable = addableFields(CATALOG, rows);
    const names = addable.map((f) => f.name);
    expect(names).toContain('album');
    expect(names).toContain('track');
    expect(names).not.toContain('title');
    expect(names).not.toContain('artist');
  });

  it('excludes read-only catalog fields', () => {
    const rows = [];
    const addable = addableFields(CATALOG, rows);
    expect(addable.find((f) => f.name === 'length')).toBeUndefined();
    expect(addable.find((f) => f.name === 'mb_trackid')).toBeUndefined();
  });

  it('excludes fields already present in rows', () => {
    const rows = CATALOG.filter((f) => f.editable).map((f) => ({
      name: f.name,
    }));
    expect(addableFields(CATALOG, rows)).toEqual([]);
  });

  it('returns empty array when catalog is empty', () => {
    expect(addableFields([], [])).toEqual([]);
    expect(addableFields(null, [])).toEqual([]);
  });
});
