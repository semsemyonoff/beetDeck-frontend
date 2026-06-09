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
