// Pure helpers for the MusicBrainz sync diff (POST /api/album/<id>/mbsync).
// No network code here — the page owns requests, this module only shapes data.

// Maps the backend's snake_case preview response into the camelCase shape
// AlbumMbsyncModal consumes, following the buildScanViewModel pattern.
export function buildMbsyncViewModel(payload) {
  if (!payload) return null;

  const albumFields = (payload.album_fields || []).map((f) => ({
    field: f.field,
    old: f.old ?? null,
    new: f.new ?? null,
  }));

  const trackFields = (payload.track_fields || []).map((f) => ({
    field: f.field,
    changes: (f.changes || []).map((c) => ({
      itemId: c.item_id,
      track: c.track ?? null,
      old: c.old ?? null,
      new: c.new ?? null,
    })),
  }));

  const unmapped = (payload.unmapped || []).map((u) => ({
    itemId: u.item_id,
    track: u.track ?? null,
    title: u.title ?? null,
  }));

  const fieldNames = Array.from(
    new Set([
      ...albumFields.map((f) => f.field),
      ...trackFields.map((f) => f.field),
    ])
  );

  return {
    albumId: payload.album_id,
    mbAlbumid: payload.mb_albumid,
    dataSource: payload.data_source,
    stashGeneration: payload.stash_generation,
    albumFields,
    trackFields,
    unmapped,
    changed: !!payload.changed,
    fieldNames,
  };
}

// Exclusion state is a Set of excluded field names; empty means everything is
// included, matching the modal's "defaulting to included" checkboxes.
export function toggleField(excluded, field) {
  const next = new Set(excluded);
  if (next.has(field)) next.delete(field);
  else next.add(field);
  return next;
}

// Produces the confirm payload's `excluded_fields` array from exclusion state.
export function excludedFieldsFor(excluded) {
  return Array.from(excluded || []).sort();
}
