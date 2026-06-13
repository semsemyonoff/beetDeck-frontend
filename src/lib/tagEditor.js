import { basename } from './disc.js';

export { basename };

export function dirname(p) {
  if (!p) return '';
  const s = String(p);
  const idx = s.lastIndexOf('/');
  if (idx < 0) return '';
  if (idx === 0) return '/';
  return s.slice(0, idx);
}

// Group untagged API items by directory.
// Returns [{ dir, root, name, albumId, files:[{id,file,title,artist,album,track,path}] }]
export function groupUntagged(items) {
  const map = new Map();
  for (const item of items || []) {
    const dir = dirname(item.path);
    if (!map.has(dir)) {
      map.set(dir, {
        dir,
        root: dirname(dir),
        name: basename(dir),
        albumId: item.album_id,
        files: [],
      });
    }
    const group = map.get(dir);
    if (group.albumId !== item.album_id) group.albumId = null;
    group.files.push({
      id: item.id,
      file: basename(item.path),
      title: item.title || '',
      artist: item.artist || '',
      album: item.album || '',
      track: item.track != null ? String(item.track) : '',
      path: item.path,
    });
  }
  return [...map.values()];
}

// Remove albums whose id is in untaggedAlbumIds from the artist list,
// and drop artists that become empty.
export function excludeUntagged(artists, untaggedAlbumIds) {
  const ids = new Set(untaggedAlbumIds);
  return (artists || [])
    .map((a) => ({ ...a, albums: (a.albums || []).filter((al) => !ids.has(al.id)) }))
    .filter((a) => a.albums.length > 0);
}

function mostCommon(rows, key) {
  const counts = {};
  for (const r of rows) {
    const v = r[key];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  const entries = Object.entries(counts);
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  return {
    value: top ? top[0] : '',
    consistent: entries.length <= 1,
  };
}

// Summarize rows: most-common-non-empty value per field + derived flags.
export function summarize(rows) {
  const albumS = mostCommon(rows, 'album');
  const aaS = mostCommon(rows, 'albumartist');
  const artistS = mostCommon(rows, 'artist');
  const albumArtist = aaS.value || (artistS.consistent ? artistS.value : '');
  const titled = (rows || []).filter((r) => String(r.title || '').trim()).length;
  const canIdentify = !!albumS.value && !!albumArtist;
  return {
    album: albumS.value,
    albumArtist,
    artistConsistent: artistS.consistent,
    titled,
    count: (rows || []).length,
    canIdentify,
  };
}

// Apply non-empty vals to all rows at indices in selectedIdxSet.
export function applyBulk(rows, selectedIdxSet, vals) {
  const clean = Object.fromEntries(
    Object.entries(vals || {}).filter(([, v]) => String(v).trim() !== '')
  );
  return (rows || []).map((r, i) => (selectedIdxSet.has(i) ? { ...r, ...clean } : r));
}

const EDITABLE_FIELDS = ['track', 'title', 'artist', 'album', 'albumartist', 'year', 'genre'];
const ITEM_FIELDS = ['title', 'artist', 'track', 'disc'];

// True if any editable field differs between row and orig.
export function rowDirty(row, orig) {
  return EDITABLE_FIELDS.some((k) => row[k] !== orig[k]);
}

// Build the POST body for /api/items/metadata-batch.
// items always carries every row id; changed per-item fields merged in.
// albumFields: { album?, albumartist?, year?, genre? } — empty values excluded.
export function batchPayload(rows, orig, albumFields) {
  const album = Object.fromEntries(
    Object.entries(albumFields || {}).filter(([, v]) => v != null && String(v).trim() !== '')
  );
  const items = (rows || []).map((row, i) => {
    const item = { id: row.id };
    const origRow = (orig || [])[i] || {};
    for (const k of ITEM_FIELDS) {
      if (row[k] !== origRow[k]) item[k] = row[k];
    }
    return item;
  });
  return { album, items };
}
