// Normalize a raw beets field value for display/edit.
// List-typed fields (e.g. genres) may arrive with \x00 or comma delimiters — flatten to ", ".
function normalizeValue(value, type) {
  if (type === 'list') {
    if (value == null || value === '') return '';
    // Replace null-byte delimiter (beets internal) with comma before splitting
    return String(value)
      .split('\x00')
      .join(',')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }
  return value == null ? '' : String(value);
}

// Build ordered rows from current track tags + field catalog.
// Rows with a catalog entry appear first (in catalog order), then unknown keys.
// All returned rows have present=true (they come from the current tags snapshot).
// Unknown keys (not in catalog) default to editable=true (flexible attrs).
export function mergeRows(tags, catalog) {
  const catalogMap = new Map((catalog || []).map((f) => [f.name, f]));
  const tagKeys = new Set(Object.keys(tags || {}));
  const rows = [];

  // Catalog-ordered fields that exist in the current tags
  for (const field of catalog || []) {
    if (!tagKeys.has(field.name)) continue;
    rows.push({
      name: field.name,
      value: normalizeValue((tags || {})[field.name], field.type),
      editable: field.editable,
      album_level: field.album_level,
      present: true,
    });
  }

  // Extra keys in tags not represented in the catalog (unknown flexible attrs)
  for (const name of Object.keys(tags || {})) {
    if (catalogMap.has(name)) continue;
    rows.push({
      name,
      value: normalizeValue((tags || {})[name], null),
      editable: true,
      album_level: false,
      present: true,
    });
  }

  return rows;
}

// Compute the set of changed/added fields relative to the original rows at load time.
// Returns { name: value } for fields whose value differs from orig.
export function delta(rows, orig) {
  const origMap = new Map((orig || []).map((r) => [r.name, r.value]));
  const result = {};
  for (const row of rows || []) {
    const origVal = origMap.has(row.name) ? origMap.get(row.name) : undefined;
    if (origVal !== row.value) {
      result[row.name] = row.value;
    }
  }
  return result;
}

// Return catalog entries that are editable and not already present in the current rows.
// Used to populate the "Add tag" dropdown.
export function addableFields(catalog, rows) {
  const presentNames = new Set((rows || []).map((r) => r.name));
  return (catalog || []).filter((f) => f.editable && !presentNames.has(f.name));
}
