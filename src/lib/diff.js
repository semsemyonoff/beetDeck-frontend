import { parseLyricLines } from './lyrics.js';

export function distanceToScore(distance) {
  if (typeof distance !== 'number') return 0;
  return Math.round(Math.max(0, Math.min(1, 1 - distance)) * 100);
}

export function buildDiffRows(applyData) {
  if (!applyData) return [];
  const rows = [];
  const album = applyData.album || {};
  for (const [field, val] of Object.entries(album)) {
    const oldV = (val?.old ?? '').toString();
    const newV = (val?.new ?? '').toString();
    let status = 'same';
    if (oldV === newV) status = 'same';
    else if (!oldV) status = 'add';
    else status = 'change';
    rows.push({ field, current: oldV || '—', proposed: newV || '—', status });
  }
  const tracks = applyData.tracks || [];
  let changedTracks = 0;
  for (const t of tracks) {
    for (const f of ['title', 'artist']) {
      const v = t[f];
      if (v && (v.old ?? '') !== (v.new ?? '')) {
        changedTracks++;
        break;
      }
    }
  }
  if (tracks.length) {
    rows.push({
      field: 'tracks',
      current: `${tracks.length} track${tracks.length === 1 ? '' : 's'}`,
      proposed: changedTracks ? `${changedTracks} updated` : 'unchanged',
      status: changedTracks ? 'change' : 'same',
    });
  }
  return rows;
}

export function buildAlbumDiffRows(album) {
  if (!album) return [];
  return Object.entries(album).map(([field, vals]) => {
    const oldV = (vals?.old ?? '').toString();
    const newV = (vals?.new ?? '').toString();
    let status = 'same';
    if (oldV === newV) status = 'same';
    else if (!oldV) status = 'add';
    else status = 'change';
    return { field, current: oldV || '—', proposed: newV || '—', status };
  });
}

export function buildLyricsPreview(current, fetched) {
  const old = (current || '').trim();
  const newLyrics = (fetched || '').trim();
  return { old, new: newLyrics, hasChange: old !== newLyrics };
}

// Line-level diff for the lyrics compare panes. Returns two aligned columns:
// `old` carries the current lyrics (lines either `same` or `removed`), `new`
// carries the fetched lyrics (lines either `same` or `added`) — a git-style
// side-by-side. Each line is a parsed `{ ts, text, type }` so the panes can
// render the LRC timecode column like the album page. The LCS is keyed on the
// lyric text only (timecodes ignored), so synced lyrics whose timestamps drift
// still diff on the words rather than flagging every line as changed.
export function buildLyricsLineDiff(current, fetched) {
  const oldText = (current || '').trim();
  const newText = (fetched || '').trim();
  const a = oldText ? parseLyricLines(oldText) : [];
  const b = newText ? parseLyricLines(newText) : [];
  const n = a.length;
  const m = b.length;

  // dp[i][j] = length of LCS of a[i:] and b[j:], comparing text only.
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].text === b[j].text
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const oldLines = [];
  const newLines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) {
      oldLines.push({ ...a[i], type: 'same' });
      newLines.push({ ...b[j], type: 'same' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      oldLines.push({ ...a[i], type: 'removed' });
      i++;
    } else {
      newLines.push({ ...b[j], type: 'added' });
      j++;
    }
  }
  while (i < n) oldLines.push({ ...a[i++], type: 'removed' });
  while (j < m) newLines.push({ ...b[j++], type: 'added' });

  return { old: oldLines, new: newLines, hasChange: oldText !== newText };
}
