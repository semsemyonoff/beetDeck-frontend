export function basename(p) {
  if (!p) return '';
  const parts = String(p).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export function fmtMins(sec) {
  const m = Math.round((sec || 0) / 60);
  return `${m} min`;
}

export function fmtTotal(sec) {
  if (!sec) return '0 min';
  const m = Math.floor(sec / 60);
  return `${m} min`;
}

export function parseLength(str) {
  if (!str) return 0;
  const [m, s] = String(str).split(':').map(Number);
  if (Number.isNaN(m) || Number.isNaN(s)) return 0;
  return m * 60 + s;
}

export function discStats(discs) {
  return (discs || []).map((d) => ({
    disc: d.disc,
    count: d.track_count,
    mins: Math.round((d.duration_sec || 0) / 60),
    sec: d.duration_sec || 0,
    dirName: basename(d.dir) || `CD${d.disc}`,
  }));
}

export function groupByDisc(tracks, stats) {
  if (!stats.length) {
    return [{ disc: 1, count: tracks.length, mins: 0, dirName: '', tracks }];
  }
  return stats.map((s) => ({
    ...s,
    tracks: tracks.filter((t) => (t.disc || 1) === s.disc),
  }));
}
