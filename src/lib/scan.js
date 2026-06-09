// Shape the rescan-status payload into a banner summary.
// The backend `/api/rescan/status` returns `added`/`removed` as arrays of
// item objects ({id, title, artist}); the banner only needs their counts.
// Returns null when no diff is available (no snapshot was taken).
export function buildScanSummary(d) {
  if (!d || !Array.isArray(d.added)) return null;
  return {
    added: d.added.length,
    removed: Array.isArray(d.removed) ? d.removed.length : 0,
  };
}
