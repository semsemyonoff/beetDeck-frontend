import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { distanceToScore, buildDiffRows } from '../lib/diff.js';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { navigate } from '../useHashRoute.js';

function Score({ score }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const off = c - (pct / 100) * c;
  const tone =
    pct >= 95 ? 'var(--ok)' : pct >= 85 ? 'var(--accent)' : 'var(--warn)';
  return (
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="3"
      />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="3"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <text
        x="16"
        y="19"
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="currentColor"
        fontFamily="Geist Mono, monospace"
      >
        {pct}
      </text>
    </svg>
  );
}

export default function ItemsIdentifyModal({
  itemIds,
  searchArtist,
  searchAlbum,
  onClose,
}) {
  useModalDismiss(onClose);
  const [phase, setPhase] = useState('searching'); // searching | results | error
  const [error, setError] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [task, setTask] = useState(null); // {status, candidates}
  const [picked, setPicked] = useState(0);
  const [applyData, setApplyData] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const pollStatus = async (tid) => {
    try {
      const r = await fetch(`/api/items/identify/${tid}/status`);
      const d = r.ok ? await r.json() : null;
      if (!d) {
        setError('Status request failed.');
        setPhase('error');
        return;
      }
      setTask(d);
      if (d.status === 'running' || d.status === 'confirming') {
        pollRef.current = window.setTimeout(() => pollStatus(tid), 1000);
        return;
      }
      if (d.status === 'error') {
        setError(d.error || 'Identification failed.');
        setPhase('error');
        return;
      }
      if (d.status === 'done') {
        const cands = d.candidates || [];
        if (!cands.length) {
          setError('No candidates returned by MusicBrainz.');
          setPhase('error');
          return;
        }
        setPicked(0);
        setPhase('results');
        loadApply(tid, 0);
        return;
      }
      if (d.status === 'idle') {
        setError('Identify task disappeared. Try again.');
        setPhase('error');
      }
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  };

  const loadApply = async (tid, candidateIndex) => {
    setApplyLoading(true);
    setApplyData(null);
    try {
      const r = await fetch(`/api/items/identify/${tid}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_index: candidateIndex }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok) {
        setError(d?.error || `Apply failed (HTTP ${r.status})`);
        setApplyData(null);
      } else {
        setApplyData(d);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setApplyLoading(false);
    }
  };

  const runSearch = async () => {
    setError(null);
    setApplyData(null);
    setTask(null);
    setPhase('searching');
    try {
      const body = { item_ids: itemIds };
      if (searchArtist) body.search_artist = searchArtist;
      if (searchAlbum) body.search_album = searchAlbum;
      const r = await fetch('/api/items/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let d = null;
      try {
        d = await r.json();
      } catch {
        /* json parse failed */
      }
      if (!r.ok) {
        setError(d?.error || `Identify start failed (HTTP ${r.status})`);
        setPhase('error');
        return;
      }
      const tid = d.task_id;
      setTaskId(tid);
      pollRef.current = window.setTimeout(() => pollStatus(tid), 400);
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  };

  // Auto-start search on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = (i) => {
    if (i === picked || !taskId) return;
    setPicked(i);
    loadApply(taskId, i);
  };

  const onConfirm = async () => {
    if (!taskId) return;
    setConfirming(true);
    setError(null);
    try {
      const r = await fetch(`/api/items/identify/${taskId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_index: picked }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok) {
        setError(d?.error || `Confirm failed (HTTP ${r.status})`);
        return;
      }
      onClose();
      navigate({ name: 'album', id: d.album_id });
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirming(false);
    }
  };

  const candidates = task?.candidates || [];
  const candidate = candidates[picked];
  const diffRows = buildDiffRows(applyData);
  const changeCount = diffRows.filter((r) => r.status !== 'same').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={
          'modal modal-identify' +
          (phase === 'results' ? '' : ' modal-identify-form')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              <Icon name="sparkles" size={12} /> Identify · MusicBrainz
            </div>
            <h3 className="modal-title">
              {searchAlbum || 'Unknown Album'}
              <span className="muted">
                {' '}
                — {searchArtist || 'Unknown Artist'}
              </span>
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {phase === 'searching' ? (
          <div className="searching-state">
            <div className="spinner" />
            <div className="muted small">
              {task?.current_artist || task?.current_album
                ? `Searching ${task.current_artist} — ${task.current_album}…`
                : 'Querying musicbrainz.org…'}
            </div>
          </div>
        ) : phase === 'error' ? (
          <div className="modal-body">
            <div className="error">{error || 'Identification failed.'}</div>
            <div className="modal-foot">
              <div className="row-end">
                <button className="btn btn-ghost" onClick={runSearch}>
                  <Icon name="search" size={12} /> Retry
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error && <div className="error">{error}</div>}

            <div className="identify-body">
              <aside className="identify-candidates">
                <div className="identify-section-head">
                  <span className="muted small">Candidates</span>
                  <span className="muted xs">
                    {candidates.length} matches · sorted by score
                  </span>
                </div>
                {candidates.map((c, i) => {
                  const score = distanceToScore(c.distance);
                  return (
                    <button
                      key={c.mb_albumid || i}
                      className={
                        'candidate' + (picked === i ? ' candidate-active' : '')
                      }
                      onClick={() => onPick(i)}
                    >
                      <div className="candidate-score-ring">
                        <Score score={score} />
                      </div>
                      <div className="candidate-info">
                        <div className="candidate-title">{c.album}</div>
                        <div className="candidate-byline">
                          {c.artist}
                          {c.year ? ` · ${c.year}` : ''}
                        </div>
                        <div className="candidate-meta">
                          {c.media ? <span>{c.media}</span> : null}
                          {c.media && c.track_count ? (
                            <span className="dot">·</span>
                          ) : null}
                          <span>{c.track_count} tracks</span>
                          {c.data_source ? (
                            <>
                              <span className="dot">·</span>
                              <span>{c.data_source}</span>
                            </>
                          ) : null}
                        </div>
                        {c.label ? (
                          <div className="candidate-meta candidate-meta-faint">
                            {c.label}
                          </div>
                        ) : null}
                      </div>
                      {picked === i ? <Icon name="check" size={14} /> : null}
                    </button>
                  );
                })}
              </aside>

              <section className="identify-diff">
                <div className="identify-section-head">
                  <div>
                    <span className="muted small">Changes</span>
                    <span className="diff-summary">
                      <span className="diff-pill diff-pill-change">
                        {applyLoading ? '…' : `${changeCount} changes`}
                      </span>
                      <span className="muted xs">whole-candidate apply</span>
                    </span>
                  </div>
                </div>

                {applyLoading ? (
                  <div className="muted small">Computing diff…</div>
                ) : (
                  <div className="diff-list">
                    {diffRows.map((row) => (
                      <div
                        key={row.field}
                        className={'diff-row diff-row-' + row.status}
                      >
                        <span className="diff-field">{row.field}</span>
                        <span className="diff-cells">
                          <span className="diff-before">
                            {row.current === '—' ? (
                              <span className="muted">empty</span>
                            ) : (
                              row.current
                            )}
                          </span>
                          <span className="diff-arrow">
                            <Icon name="chevron" size={10} />
                          </span>
                          <span className="diff-after">
                            {row.proposed === '—' ? (
                              <span className="muted">remove</span>
                            ) : (
                              row.proposed
                            )}
                          </span>
                        </span>
                        <span className="diff-tag">
                          {row.status === 'same' && (
                            <span className="diff-tag-same">unchanged</span>
                          )}
                          {row.status === 'add' && (
                            <span className="diff-tag-add">+ add</span>
                          )}
                          {row.status === 'change' && (
                            <span className="diff-tag-change">~ change</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="modal-foot identify-foot">
              <div className="identify-foot-left">
                <span className="muted small">Match score</span>
                <strong className="identify-score">
                  {candidate ? distanceToScore(candidate.distance) : 0}%
                </strong>
                {candidate?.mb_albumid ? (
                  <span className="muted xs">
                    <span className="mono">
                      {String(candidate.mb_albumid).slice(0, 8)}…
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="row-end">
                <button className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={confirming || applyLoading || !candidate}
                  onClick={onConfirm}
                >
                  <Icon name="check" size={12} />{' '}
                  {confirming
                    ? 'Applying…'
                    : `Apply ${changeCount} change${changeCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
