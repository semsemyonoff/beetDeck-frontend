import { useState } from 'react';
import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { toggleField, excludedFieldsFor } from '../lib/mbsync.js';

function Cell({ value }) {
  return value ? value : <span className="muted">empty</span>;
}

function AlbumFieldRow({ row }) {
  return (
    <div className="amm-row">
      <span className="amm-field">{row.field}</span>
      <span className="diff-cells">
        <span className="diff-before">
          <Cell value={row.old} />
        </span>
        <span className="diff-arrow">
          <Icon name="chevron" size={10} />
        </span>
        <span className="diff-after">
          <Cell value={row.new} />
        </span>
      </span>
    </div>
  );
}

function TrackFieldGroup({ group }) {
  return (
    <div className="amm-track-group">
      <div className="amm-track-group-head">
        <span className="amm-field">{group.field}</span>
        <span className="muted xs">
          {group.changes.length} track{group.changes.length === 1 ? '' : 's'}
        </span>
      </div>
      {group.changes.map((c) => (
        <div key={c.itemId} className="amm-row amm-track-row">
          <span className="amm-track-num">
            {c.track != null ? String(c.track).padStart(2, '0') : '—'}
          </span>
          <span className="diff-cells">
            <span className="diff-before">
              <Cell value={c.old} />
            </span>
            <span className="diff-arrow">
              <Icon name="chevron" size={10} />
            </span>
            <span className="diff-after">
              <Cell value={c.new} />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function UnmappedRow({ item }) {
  return (
    <div className="amm-row amm-unmapped-row">
      <span className="amm-track-num">
        {item.track != null ? String(item.track).padStart(2, '0') : '—'}
      </span>
      <span className="amm-unmapped-title">{item.title || '(untitled)'}</span>
      <span className="muted small">
        not matched to the release, left as is
      </span>
    </div>
  );
}

export default function AlbumMbsyncModal({
  viewModel,
  confirming = false,
  error = null,
  onConfirm,
  onClose,
}) {
  useModalDismiss(onClose);
  const [excluded, setExcluded] = useState(new Set());

  const toggle = (field) => setExcluded((prev) => toggleField(prev, field));

  const {
    fieldNames = [],
    albumFields = [],
    trackFields = [],
    unmapped = [],
    changed = false,
  } = viewModel || {};

  const nothingToUpdate = !changed && unmapped.length === 0;
  const allExcluded =
    fieldNames.length > 0 &&
    excludedFieldsFor(excluded).length === fieldNames.length;

  const handleConfirm = () => {
    onConfirm(excludedFieldsFor(excluded));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-album-mbsync"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              <Icon name="refresh" size={12} /> Sync with MusicBrainz
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="modal-body amm-body">
          {error && <div className="error">{error}</div>}

          {nothingToUpdate ? (
            <p className="muted amm-empty">
              Nothing to update — the release already matches.
            </p>
          ) : (
            <>
              {changed && fieldNames.length > 0 && (
                <div className="amm-toggles">
                  <div className="muted small">Fields to write</div>
                  <div className="amm-toggle-list">
                    {fieldNames.map((field) => (
                      <label key={field} className="amm-field-toggle">
                        <input
                          type="checkbox"
                          checked={!excluded.has(field)}
                          onChange={() => toggle(field)}
                        />
                        <span className="mono">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {albumFields.length > 0 && (
                <section className="amm-section">
                  <div className="amm-section-head muted small">Album</div>
                  {albumFields.map((row) => (
                    <AlbumFieldRow key={row.field} row={row} />
                  ))}
                </section>
              )}

              {trackFields.length > 0 && (
                <section className="amm-section">
                  <div className="amm-section-head muted small">Tracks</div>
                  {trackFields.map((group) => (
                    <TrackFieldGroup key={group.field} group={group} />
                  ))}
                </section>
              )}
            </>
          )}

          {unmapped.length > 0 && (
            <section className="amm-section amm-unmapped">
              <div className="amm-section-head muted small">
                Not matched to the release
              </div>
              {unmapped.map((item) => (
                <UnmappedRow key={item.itemId} item={item} />
              ))}
            </section>
          )}
        </div>

        <div className="modal-foot">
          <div className="row-end">
            <button className="btn btn-ghost" onClick={onClose}>
              {nothingToUpdate ? 'Close' : 'Cancel'}
            </button>
            {!nothingToUpdate && (
              <button
                className="btn btn-primary"
                disabled={confirming || allExcluded}
                onClick={handleConfirm}
              >
                <Icon name="check" size={12} />{' '}
                {confirming ? 'Writing…' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
