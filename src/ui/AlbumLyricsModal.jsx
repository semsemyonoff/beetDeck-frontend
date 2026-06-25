import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { buildLyricsPreview } from '../lib/diff.js';

function AlmRow({ row, applying, onApplyOne }) {
  const {
    id,
    title,
    artist,
    track: trackNum,
    disc,
    state,
    newLyrics,
    currentLyrics,
  } = row;

  const discPrefix = disc > 1 ? `${disc}-` : '';
  const trackLabel =
    discPrefix + (trackNum != null ? String(trackNum).padStart(2, '0') : '—');
  const preview =
    state === 'found' ? buildLyricsPreview(currentLyrics, newLyrics) : null;

  return (
    <div className={`alm-row alm-row-${state}`}>
      <div className="alm-row-head">
        <span className="alm-track-num">{trackLabel}</span>
        <span className="alm-track-title">{title || '(untitled)'}</span>
        {artist && (
          <span className="alm-track-artist muted small">{artist}</span>
        )}
        <div className="alm-row-status">
          {state === 'found' && (
            <button
              className="btn btn-sm btn-primary"
              disabled={applying}
              onClick={() => onApplyOne(id)}
            >
              <Icon name="check" size={11} /> Apply
            </button>
          )}
          {state === 'applying' && (
            <>
              <span className="btn-spinner" />
              <span className="muted small">Applying…</span>
            </>
          )}
          {state === 'applied' && (
            <span className="alm-badge alm-badge-ok">
              <Icon name="check" size={11} /> Applied
            </span>
          )}
          {state === 'skipped' && (
            <span className="alm-badge alm-badge-muted">Has lyrics</span>
          )}
          {state === 'not-found' && (
            <span className="alm-badge alm-badge-muted">Not found</span>
          )}
          {state === 'error' && (
            <span className="alm-badge alm-badge-err">Error</span>
          )}
        </div>
      </div>
      {state === 'found' && preview && (
        <div className="lyrics-compare alm-compare">
          <pre className="lyrics-pre lyrics-compare-pane">
            {preview.old || '(empty)'}
          </pre>
          <pre className="lyrics-pre lyrics-compare-pane">{preview.new}</pre>
        </div>
      )}
    </div>
  );
}

export default function AlbumLyricsModal({
  tracks,
  progress,
  applying,
  onApplyAll,
  onApplyOne,
  onClose,
}) {
  useModalDismiss(onClose);

  const foundTracks = tracks.filter((t) => t.state === 'found');
  const readyCount = foundTracks.length;
  const { done = 0, total = 0 } = progress || {};
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleApplyAll = () => {
    onApplyAll(foundTracks.map((t) => t.id));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-album-lyrics"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head alm-head">
          <div className="alm-head-left">
            <div className="modal-eyebrow">
              <Icon name="lyrics" size={12} /> Fetch all lyrics
            </div>
            <div className="alm-progress">
              <div className="alm-progress-bar">
                <div
                  className="alm-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="muted small alm-progress-text">
                {done} of {total} fetched
              </span>
            </div>
          </div>
          <div className="alm-head-right">
            {readyCount > 0 && (
              <span className="muted small alm-ready-count">
                ready to apply: {readyCount}
              </span>
            )}
            <button
              className="btn btn-primary btn-sm"
              disabled={applying || readyCount === 0}
              onClick={handleApplyAll}
            >
              <Icon name="check" size={11} /> Apply all
            </button>
            <button className="btn-icon" onClick={onClose}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body alm-body">
          {tracks.map((t) => (
            <AlmRow
              key={t.id}
              row={t}
              applying={applying}
              onApplyOne={onApplyOne}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
