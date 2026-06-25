import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { buildLyricsLineDiff } from '../lib/diff.js';

function DiffPane({ lines, emptyLabel }) {
  if (!lines.length) {
    return (
      <div className="lyrics-pre lyrics-compare-pane">
        <span className="muted">{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div className="lyrics-pre lyrics-compare-pane">
      {lines.map((ln, idx) => {
        const blank = !ln.text.trim();
        return (
          <div
            key={idx}
            className={
              `lyric-line diff-line diff-line-${ln.type}` +
              (blank ? ' lyric-line-blank' : '')
            }
          >
            <span className="lyric-ts mono">{ln.ts ? `[${ln.ts}]` : ''}</span>
            <span className="lyric-text">{blank ? '♪' : ln.text}</span>
          </div>
        );
      })}
    </div>
  );
}

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
  const diff =
    state === 'found' ? buildLyricsLineDiff(currentLyrics, newLyrics) : null;

  return (
    <div className={`alm-row alm-row-${state}`}>
      <div className="alm-row-head">
        <span className="alm-track-num">{trackLabel}</span>
        <span className="alm-track-title">{title || '(untitled)'}</span>
        {artist && (
          <span className="alm-track-artist muted small">{artist}</span>
        )}
        <div className="alm-row-status">
          {state === 'pending' && (
            <>
              <span className="btn-spinner" />
              <span className="muted small">Fetching…</span>
            </>
          )}
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
      {state === 'found' && diff && (
        <div className="alm-compare">
          <div className="lyrics-compare-col">
            <div className="muted small lyrics-compare-label">Current</div>
            <DiffPane lines={diff.old} emptyLabel="(empty)" />
          </div>
          <div className="lyrics-compare-col">
            <div className="muted small lyrics-compare-label">
              New
              {diff.hasChange ? (
                <span className="lyrics-compare-tag">changed</span>
              ) : (
                <span className="lyrics-compare-tag lyrics-compare-tag-same">
                  identical
                </span>
              )}
            </div>
            <DiffPane lines={diff.new} emptyLabel="(empty)" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlbumLyricsModal({
  tracks,
  progress,
  fetching,
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
              disabled={fetching || applying || readyCount === 0}
              onClick={handleApplyAll}
            >
              {fetching || applying ? (
                <span className="btn-spinner" />
              ) : (
                <Icon name="check" size={11} />
              )}{' '}
              Apply all
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
