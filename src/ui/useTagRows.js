import { useState, useCallback, useMemo } from 'react';
import {
  applyBulk as libApplyBulk,
  rowDirty,
  summarize,
  batchPayload,
} from '../lib/tagEditor.js';

// Normalise an initial row list into the editor row shape.
function initRows(initialRows) {
  return (initialRows || []).map((r) => ({ ...r }));
}

export function useTagRows(initialRows) {
  const [rows, setRows] = useState(() => initRows(initialRows));
  const [orig, setOrig] = useState(() => initRows(initialRows));
  const [selected, setSelected] = useState(() => new Set());
  const [saved, setSaved] = useState(false);

  const setField = useCallback((rowIndex, key, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
    setSaved(false);
  }, []);

  const toggle = useCallback((rowIndex) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((_, i) => i));
    });
  }, [rows]);

  const clearSel = useCallback(() => setSelected(new Set()), []);

  const allSelected = selected.size === rows.length && rows.length > 0;

  const applyBulk = useCallback(
    (vals) => {
      setRows((prev) => libApplyBulk(prev, selected, vals));
      setSaved(false);
    },
    [selected]
  );

  const dirty = useCallback(
    (rowIndex, key) => {
      const row = rows[rowIndex];
      const origRow = orig[rowIndex];
      if (!row || !origRow) return false;
      return row[key] !== origRow[key];
    },
    [rows, orig]
  );

  const dirtyCount = useMemo(
    () => rows.filter((r, i) => rowDirty(r, orig[i] || {})).length,
    [rows, orig]
  );

  // commit(persist?) — if persist is provided it is called with batchPayload; resets baseline.
  // albumFields defaults to an empty object; callers pass album-level values separately.
  const commit = useCallback(
    async (persist, albumFields) => {
      if (persist) {
        const payload = batchPayload(rows, orig, albumFields || {});
        await persist(payload);
      }
      setOrig(rows.map((r) => ({ ...r })));
      setSaved(true);
    },
    [rows, orig]
  );

  // Reconcile a row (and its baseline) with values persisted elsewhere — e.g.
  // after the per-track free-tag editor saves the same item. Updating both rows
  // and orig keeps the grid in sync without marking the row dirty, so a later
  // batch write neither re-sends nor reverts those fields.
  const syncRow = useCallback((id, patch) => {
    if (!patch || Object.keys(patch).length === 0) return;
    const apply = (list) =>
      list.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(apply);
    setOrig(apply);
  }, []);

  const summary = useMemo(() => summarize(rows), [rows]);

  return {
    rows,
    setField,
    syncRow,
    selected,
    toggle,
    selectAll,
    clearSel,
    allSelected,
    applyBulk,
    dirty,
    dirtyCount,
    commit,
    saved,
    summary,
  };
}
