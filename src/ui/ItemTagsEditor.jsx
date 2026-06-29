import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { mergeRows, delta, addableFields } from '../lib/itemTags.js';

export default function ItemTagsEditor({ albumId, item, onClose, onSaved }) {
  useModalDismiss(onClose);

  const [rows, setRows] = useState(null);
  const [orig, setOrig] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [addSearch, setAddSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const addInputRef = useRef(null);

  useEffect(() => {
    let aborted = false;
    Promise.all([
      fetch(`/api/album/${albumId}/track/${item.id}/tags`).then((r) =>
        r.ok ? r.json() : Promise.reject('HTTP ' + r.status)
      ),
      fetch('/api/items/fields').then((r) =>
        r.ok ? r.json() : Promise.reject('HTTP ' + r.status)
      ),
    ])
      .then(([tags, fields]) => {
        if (aborted) return;
        const merged = mergeRows(tags, fields);
        setCatalog(fields);
        setRows(merged);
        setOrig(merged);
      })
      .catch((e) => {
        if (!aborted) setError(String(e));
      });
    return () => {
      aborted = true;
    };
  }, [albumId, item.id]);

  useEffect(() => {
    if (addOpen) addInputRef.current?.focus();
  }, [addOpen]);

  const setRowValue = (name, value) =>
    setRows((prev) => prev.map((r) => (r.name === name ? { ...r, value } : r)));

  const addRow = (field) => {
    setRows((prev) => [
      ...prev,
      {
        name: field.name,
        value: '',
        editable: true,
        album_level: field.album_level,
        present: false,
      },
    ]);
    setAddSearch('');
    setAddOpen(false);
  };

  const handleSave = async () => {
    const d = delta(rows, orig);
    if (Object.keys(d).length === 0) return;
    setSaving(true);
    setWarnings([]);
    try {
      const r = await fetch(`/api/items/${item.id}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: d }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      const ws = data.warnings || [];
      // Hand the saved delta back so an opener (e.g. the album batch editor)
      // can refresh its own stale view of this track instead of overwriting
      // the just-saved values on a later batch write.
      if (onSaved) onSaved({ warnings: ws, fields: d });
      if (ws.length) {
        setWarnings(ws);
      } else {
        onClose();
      }
    } catch (e) {
      setWarnings([String(e)]);
    } finally {
      setSaving(false);
    }
  };

  const d = rows && orig ? delta(rows, orig) : {};
  const hasChanges = Object.keys(d).length > 0;

  const addable = catalog && rows ? addableFields(catalog, rows) : [];
  const filteredAddable = addSearch
    ? addable.filter((f) =>
        f.name.toLowerCase().includes(addSearch.toLowerCase())
      )
    : addable;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-tagedit" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              <Icon name="tag" size={12} /> Edit all tags
            </div>
            <h3 className="modal-title">{item.title || 'Track'}</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="modal-body">
          {warnings.length > 0 && (
            <div className="flash flash-warn">{warnings.join('; ')}</div>
          )}
          {error ? (
            <div className="error">Failed to load tags: {error}</div>
          ) : rows == null ? (
            <div className="muted">Loading…</div>
          ) : (
            <>
              <div className="ite-rows">
                {rows.map((row) => (
                  <div
                    key={row.name}
                    className={
                      'ite-row' + (row.album_level ? ' ite-row-album' : '')
                    }
                  >
                    <span className="ite-name mono small">{row.name}</span>
                    {row.editable ? (
                      <input
                        className="ite-input"
                        value={row.value}
                        spellCheck={false}
                        onChange={(e) => setRowValue(row.name, e.target.value)}
                      />
                    ) : (
                      <span className="ite-value-ro">{row.value}</span>
                    )}
                    <span className="ite-row-icon">
                      {row.album_level && (
                        <span title="Writing this field affects only this track and may split the album">
                          <Icon name="alert" size={12} />
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="ite-add">
                <button
                  className="btn btn-ghost"
                  onClick={() => setAddOpen((o) => !o)}
                >
                  + Add tag
                </button>
                {addOpen && (
                  <div className="ite-add-panel">
                    <input
                      ref={addInputRef}
                      className="form-input ite-add-search"
                      placeholder="Search fields…"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                    />
                    <div className="ite-add-list">
                      {filteredAddable.length === 0 ? (
                        <div className="muted small ite-add-empty">
                          No fields available
                        </div>
                      ) : (
                        filteredAddable.map((f) => (
                          <button
                            key={f.name}
                            className="ite-add-item"
                            onClick={() => addRow(f)}
                          >
                            <span className="mono">{f.name}</span>
                            {f.album_level && (
                              <span className="muted small"> · album</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="row-end">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !hasChanges}
              onClick={handleSave}
            >
              <Icon name="check" size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
