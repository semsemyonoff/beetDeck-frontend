import { describe, it, expect } from 'vitest';
import {
  dirname,
  groupUntagged,
  excludeUntagged,
  summarize,
  applyBulk,
  rowDirty,
  batchPayload,
} from './tagEditor.js';

// ─────────────────────────────────────────────────────────────────────────────
//  dirname
// ─────────────────────────────────────────────────────────────────────────────

describe('dirname', () => {
  it('returns parent directory', () => {
    expect(dirname('/Music/Artist/Album/song.mp3')).toBe('/Music/Artist/Album');
  });

  it('handles one-level deep path', () => {
    expect(dirname('/Music/song.mp3')).toBe('/Music');
  });

  it('returns slash for file at root', () => {
    expect(dirname('/song.mp3')).toBe('/');
  });

  it('returns empty for no slash', () => {
    expect(dirname('song.mp3')).toBe('');
  });

  it('returns empty for null/undefined', () => {
    expect(dirname(null)).toBe('');
    expect(dirname(undefined)).toBe('');
    expect(dirname('')).toBe('');
  });

  it('handles paths with spaces', () => {
    expect(dirname('/Music/Loose Bits/01 song.mp3')).toBe('/Music/Loose Bits');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  groupUntagged
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS = [
  { id: 1, title: 'Alpha', artist: 'Art', album: 'Alb', path: '/m/FolderA/01.mp3', track: 1, album_id: 10 },
  { id: 2, title: 'Beta',  artist: 'Art', album: 'Alb', path: '/m/FolderA/02.mp3', track: 2, album_id: 10 },
  { id: 3, title: 'Gamma', artist: 'B',   album: '',    path: '/m/FolderB/01.mp3', track: 1, album_id: 20 },
];

describe('groupUntagged', () => {
  it('groups items by directory', () => {
    const groups = groupUntagged(ITEMS);
    expect(groups).toHaveLength(2);
  });

  it('sets dir, root, name correctly', () => {
    const groups = groupUntagged(ITEMS);
    const a = groups.find((g) => g.name === 'FolderA');
    expect(a).toBeDefined();
    expect(a.dir).toBe('/m/FolderA');
    expect(a.root).toBe('/m');
    expect(a.name).toBe('FolderA');
  });

  it('sets albumId when all files share one', () => {
    const groups = groupUntagged(ITEMS);
    const a = groups.find((g) => g.name === 'FolderA');
    expect(a.albumId).toBe(10);
  });

  it('sets albumId to null when files have mixed album_ids', () => {
    const mixed = [
      { id: 1, title: 'A', artist: '', album: '', path: '/x/01.mp3', track: 1, album_id: 10 },
      { id: 2, title: 'B', artist: '', album: '', path: '/x/02.mp3', track: 2, album_id: 99 },
    ];
    const groups = groupUntagged(mixed);
    expect(groups[0].albumId).toBeNull();
  });

  it('builds file entries with basename', () => {
    const groups = groupUntagged(ITEMS);
    const a = groups.find((g) => g.name === 'FolderA');
    expect(a.files).toHaveLength(2);
    expect(a.files[0]).toMatchObject({ id: 1, file: '01.mp3', title: 'Alpha', track: '1' });
  });

  it('normalises missing title/artist/album to empty strings', () => {
    const items = [{ id: 5, title: null, artist: undefined, album: null, path: '/m/X/01.mp3', track: null, album_id: 1 }];
    const groups = groupUntagged(items);
    expect(groups[0].files[0]).toMatchObject({ title: '', artist: '', album: '', track: '' });
  });

  it('handles a single-file folder', () => {
    const items = [{ id: 7, title: 'Solo', artist: 'S', album: 'SA', path: '/solo/01.mp3', track: 1, album_id: 42 }];
    const groups = groupUntagged(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(1);
    expect(groups[0].albumId).toBe(42);
  });

  it('returns empty array for empty input', () => {
    expect(groupUntagged([])).toEqual([]);
    expect(groupUntagged(null)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  excludeUntagged
// ─────────────────────────────────────────────────────────────────────────────

const ARTISTS = [
  { name: 'Unknown Artist', albums: [{ id: 10, title: 'Loose' }] },
  { name: 'Known Band',     albums: [{ id: 20, title: 'EP' }, { id: 30, title: 'LP' }] },
  { name: 'Solo Act',       albums: [{ id: 40, title: 'Demo' }] },
];

describe('excludeUntagged', () => {
  it('removes albums whose id is in the untagged set', () => {
    const result = excludeUntagged(ARTISTS, [10]);
    const known = result.find((a) => a.name === 'Known Band');
    expect(known.albums).toHaveLength(2);
  });

  it('drops an artist when all their albums are untagged', () => {
    const result = excludeUntagged(ARTISTS, [10]);
    const ua = result.find((a) => a.name === 'Unknown Artist');
    expect(ua).toBeUndefined();
  });

  it('preserves artists with remaining albums', () => {
    const result = excludeUntagged(ARTISTS, [20]);
    const known = result.find((a) => a.name === 'Known Band');
    expect(known.albums).toHaveLength(1);
    expect(known.albums[0].id).toBe(30);
  });

  it('removes nothing when ids set is empty', () => {
    const result = excludeUntagged(ARTISTS, []);
    expect(result).toHaveLength(3);
  });

  it('handles null/undefined gracefully', () => {
    expect(excludeUntagged(null, [])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  summarize
// ─────────────────────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('picks most-common non-empty album', () => {
    const rows = [
      { album: 'X', albumartist: 'AA', artist: 'A', title: 'T1', year: '2020', genre: '' },
      { album: 'X', albumartist: 'AA', artist: 'A', title: 'T2', year: '2020', genre: '' },
      { album: 'Y', albumartist: 'AA', artist: 'A', title: '',   year: '2020', genre: '' },
    ];
    const s = summarize(rows);
    expect(s.album).toBe('X');
    expect(s.albumArtist).toBe('AA');
    expect(s.titled).toBe(2);
    expect(s.count).toBe(3);
  });

  it('falls back albumArtist to consistent artist when albumartist is empty', () => {
    const rows = [
      { album: 'X', albumartist: '', artist: 'Solo', title: 'T', year: '', genre: '' },
      { album: 'X', albumartist: '', artist: 'Solo', title: 'T', year: '', genre: '' },
    ];
    expect(summarize(rows).albumArtist).toBe('Solo');
  });

  it('does not fall back albumArtist when artists are inconsistent', () => {
    const rows = [
      { album: 'X', albumartist: '', artist: 'A', title: 'T', year: '', genre: '' },
      { album: 'X', albumartist: '', artist: 'B', title: 'T', year: '', genre: '' },
    ];
    expect(summarize(rows).albumArtist).toBe('');
    expect(summarize(rows).artistConsistent).toBe(false);
  });

  it('canIdentify is true when album and albumArtist are both set', () => {
    const rows = [{ album: 'EP', albumartist: 'Band', artist: 'Band', title: 'T', year: '', genre: '' }];
    expect(summarize(rows).canIdentify).toBe(true);
  });

  it('canIdentify is false when album is missing', () => {
    const rows = [{ album: '', albumartist: 'Band', artist: 'Band', title: 'T', year: '', genre: '' }];
    expect(summarize(rows).canIdentify).toBe(false);
  });

  it('returns empty/zero values for empty rows', () => {
    const s = summarize([]);
    expect(s).toEqual({ album: '', albumArtist: '', artistConsistent: true, titled: 0, count: 0, canIdentify: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  applyBulk
// ─────────────────────────────────────────────────────────────────────────────

describe('applyBulk', () => {
  const rows = [
    { id: 1, title: 'T1', album: '', albumartist: '' },
    { id: 2, title: 'T2', album: '', albumartist: '' },
    { id: 3, title: 'T3', album: '', albumartist: '' },
  ];

  it('applies non-empty vals only to selected rows', () => {
    const result = applyBulk(rows, new Set([0, 2]), { album: 'NewAlbum', albumartist: 'AA' });
    expect(result[0].album).toBe('NewAlbum');
    expect(result[1].album).toBe('');
    expect(result[2].album).toBe('NewAlbum');
  });

  it('ignores empty-string vals', () => {
    const result = applyBulk(rows, new Set([0]), { album: '', albumartist: 'AA' });
    expect(result[0].album).toBe('');
    expect(result[0].albumartist).toBe('AA');
  });

  it('returns rows unchanged when selectedIdxSet is empty', () => {
    const result = applyBulk(rows, new Set(), { album: 'X' });
    expect(result.every((r) => r.album === '')).toBe(true);
  });

  it('does not mutate original rows array', () => {
    const orig = [{ id: 1, album: 'orig' }];
    applyBulk(orig, new Set([0]), { album: 'new' });
    expect(orig[0].album).toBe('orig');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  rowDirty
// ─────────────────────────────────────────────────────────────────────────────

describe('rowDirty', () => {
  it('returns false when row matches orig', () => {
    const r = { track: '1', title: 'T', artist: 'A', album: 'X', albumartist: '', year: '', genre: '' };
    expect(rowDirty(r, { ...r })).toBe(false);
  });

  it('returns true when any field differs', () => {
    const row  = { track: '1', title: 'Changed', artist: 'A', album: 'X', albumartist: '', year: '', genre: '' };
    const orig = { track: '1', title: 'Old',     artist: 'A', album: 'X', albumartist: '', year: '', genre: '' };
    expect(rowDirty(row, orig)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  batchPayload
// ─────────────────────────────────────────────────────────────────────────────

describe('batchPayload', () => {
  const orig = [
    { id: 1, title: 'T1', artist: 'A', track: '1', disc: undefined },
    { id: 2, title: 'T2', artist: 'A', track: '2', disc: undefined },
  ];

  it('always includes every row id in items', () => {
    const rows = orig.map((r) => ({ ...r }));
    const { items } = batchPayload(rows, orig, { album: 'X', albumartist: 'AA' });
    expect(items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('album-only save emits all row ids with no per-item fields', () => {
    const rows = orig.map((r) => ({ ...r }));
    const { album, items } = batchPayload(rows, orig, { album: 'EP', albumartist: 'Band', year: '2023', genre: 'Rock' });
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(album).toEqual({ album: 'EP', albumartist: 'Band', year: '2023', genre: 'Rock' });
  });

  it('includes changed per-item fields alongside id', () => {
    const rows = [
      { id: 1, title: 'New T1', artist: 'A', track: '1', disc: undefined },
      { id: 2, title: 'T2',     artist: 'A', track: '2', disc: undefined },
    ];
    const { items } = batchPayload(rows, orig, {});
    expect(items[0]).toMatchObject({ id: 1, title: 'New T1' });
    expect(items[1]).toEqual({ id: 2 });
  });

  it('strips empty-string values from album section', () => {
    const rows = orig.map((r) => ({ ...r }));
    const { album } = batchPayload(rows, orig, { album: 'X', albumartist: '', year: '', genre: '' });
    expect(album).toEqual({ album: 'X' });
  });

  it('returns empty album object when albumFields is empty', () => {
    const rows = orig.map((r) => ({ ...r }));
    const { album } = batchPayload(rows, orig, {});
    expect(album).toEqual({});
  });

  it('handles null albumFields gracefully', () => {
    const rows = orig.map((r) => ({ ...r }));
    const { album } = batchPayload(rows, orig, null);
    expect(album).toEqual({});
  });

  it('includes track change in items', () => {
    const rows = [
      { id: 1, title: 'T1', artist: 'A', track: '5', disc: undefined },
      { id: 2, title: 'T2', artist: 'A', track: '2', disc: undefined },
    ];
    const { items } = batchPayload(rows, orig, {});
    expect(items[0].track).toBe('5');
    expect(items[1].track).toBeUndefined();
  });
});
