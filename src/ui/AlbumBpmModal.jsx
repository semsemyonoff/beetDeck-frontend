import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';

function BpmRow({ row }) {
  const { title, artist, track: trackNum, disc, state, bpm } = row;

  const discPrefix = disc > 1 ? `${disc}-` : '';
  const trackLabel =
    discPrefix + (trackNum != null ? String(trackNum).padStart(2, '0') : '—');

  return (
    <div className={`abm-row abm-row-${state}`}>
      <div className="abm-row-head">
        <span className="abm-track-num">{trackLabel}</span>
        <span className="abm-track-title">{title || '(untitled)'}</span>
        {artist && (
          <span className="abm-track-artist muted small">{artist}</span>
        )}
        <div className="abm-row-status">
          {state === 'pending' && <span className="muted small">Pending</span>}
          {state === 'computing' && (
            <>
              <span className="btn-spinner" />
              <span className="muted small">Computing…</span>
            </>
          )}
          {state === 'done' && (
            <span className="abm-badge abm-badge-ok">
              <Icon name="check" size={11} />{' '}
              {bpm != null ? `${bpm} BPM` : 'Done'}
            </span>
          )}
          {state === 'error' && (
            <span className="abm-badge abm-badge-err">Error</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlbumBpmModal({
  tracks,
  progress,
  computing,
  onClose,
}) {
  useModalDismiss(onClose);

  const { done = 0, total = 0 } = progress || {};
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-album-bpm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head abm-head">
          <div className="abm-head-left">
            <div className="modal-eyebrow">
              <Icon name="bpm" size={12} /> Compute all BPM
            </div>
            <div className="abm-progress">
              <div className="abm-progress-bar">
                <div
                  className="abm-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="muted small abm-progress-text">
                {done} of {total} computed
              </span>
            </div>
          </div>
          <div className="abm-head-right">
            <button
              className="btn btn-sm"
              disabled={computing}
              onClick={onClose}
            >
              {computing ? <span className="btn-spinner" /> : null} Close
            </button>
          </div>
        </div>

        <div className="modal-body abm-body">
          {tracks.map((t) => (
            <BpmRow key={t.id} row={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
