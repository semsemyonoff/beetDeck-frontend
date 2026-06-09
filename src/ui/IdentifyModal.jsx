import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { distanceToScore, buildDiffRows } from '../lib/diff.js';

function Score({ score }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const off = c - (pct / 100) * c;
  const tone = pct >= 95 ? 'var(--ok)' : pct >= 85 ? 'var(--accent)' : 'var(--warn)';
  return (
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
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

function SearchForm({ artistName, albumTitle, albumYear, params, setParam, onSearch, onCancel }) {
  return (
    <div className="search-form-body">
      <div className="search-form">
        <p className="search-form-intro">
          By default beets searches MusicBrainz with the tags read from the files. Override any
          field to refine the lookup, or paste a Release ID to fetch a specific one.
        </p>

        <div className="detected-row">
          <span className="muted small">Detected from files</span>
          <div className="detected-pills">
            <span className="detected-pill">
              <span className="detected-pill-k">artist</span>
              {artistName}
            </span>
            <span className="detected-pill">
              <span className="detected-pill-k">album</span>
              {albumTitle}
            </span>
            {albumYear ? (
              <span className="detected-pill">
                <span className="detected-pill-k">year</span>
                {albumYear}
              </span>
            ) : null}
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">
              Artist <span className="muted xs">(optional)</span>
            </span>
            <input
              className="form-input"
              placeholder="Override artist search"
              value={params.artist}
              onChange={(e) => setParam('artist', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">
              Album <span className="muted xs">(optional)</span>
            </span>
            <input
              className="form-input"
              placeholder="Override album search"
              value={params.album}
              onChange={(e) => setParam('album', e.target.value)}
            />
          </label>
          <label className="form-field form-field-wide">
            <span className="form-label">
              MusicBrainz Release ID <span className="muted xs">(optional — exact match)</span>
            </span>
            <input
              className="form-input mono"
              placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
              value={params.mbid}
              onChange={(e) => setParam('mbid', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="modal-foot search-form-foot">
        <span className="muted small">Tip: clear all fields to fall back to file tags.</span>
        <div className="row-end">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSearch}>
            <Icon name="search" size={12} /> Search MusicBrainz
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchingState({ note }) {
  return (
    <div className="searching-state">
      <div className="spinner" />
      <div className="muted small">{note || 'Querying musicbrainz.org…'}</div>
    </div>
  );
}

export default function IdentifyModal({ albumId, artistName, albumTitle, albumYear, onClose, onConfirmed }) {
  const [phase, setPhase] = useState('form'); // form | searching | results | error
  const [params, setParams] = useState({ artist: '', album: '', mbid: '' });
  const [error, setError] = useState(null);
  const [task, setTask] = useState(null); // {status, candidates, error}
  const [picked, setPicked] = useState(0);
  const [applyData, setApplyData] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const setParam = (k, v) => setParams((p) => ({ ...p, [k]: v }));

  const pollStatus = async () => {
    try {
      const r = await fetch(`/api/album/${albumId}/identify/status`);
      const d = r.ok ? await r.json() : null;
      if (!d) {
        setError('Status request failed.');
        setPhase('error');
        return;
      }
      setTask(d);
      if (d.status === 'running' || d.status === 'confirming') {
        pollRef.current = window.setTimeout(pollStatus, 1000);
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
        loadApply(0);
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

  const loadApply = async (candidateIndex) => {
    setApplyLoading(true);
    setApplyData(null);
    try {
      const r = await fetch(`/api/album/${albumId}/apply`, {
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
    const body = {};
    if (params.artist.trim()) body.artist = params.artist.trim();
    if (params.album.trim()) body.album = params.album.trim();
    if (params.mbid.trim()) body.search_id = params.mbid.trim();
    try {
      const r = await fetch(`/api/album/${albumId}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok && r.status !== 409) {
        setError(d?.error || `Identify start failed (HTTP ${r.status})`);
        setPhase('error');
        return;
      }
      pollRef.current = window.setTimeout(pollStatus, 400);
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  };

  const onPick = (i) => {
    if (i === picked) return;
    setPicked(i);
    loadApply(i);
  };

  const onConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const r = await fetch(`/api/album/${albumId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_index: picked }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok) {
        setError(d?.error || `Confirm failed (HTTP ${r.status})`);
        return;
      }
      if (onConfirmed) onConfirmed();
      onClose();
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

  const summary = [];
  if (params.artist) summary.push(['artist', params.artist]);
  if (params.album) summary.push(['album', params.album]);
  if (params.mbid) summary.push(['mb', params.mbid.slice(0, 8) + '…']);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={'modal modal-identify' + (phase === 'results' ? '' : ' modal-identify-form')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              <Icon name="sparkles" size={12} /> Identify · MusicBrainz
            </div>
            <h3 className="modal-title">
              {albumTitle} <span className="muted">— {artistName}</span>
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {phase === 'form' ? (
          <SearchForm
            artistName={artistName}
            albumTitle={albumTitle}
            albumYear={albumYear}
            params={params}
            setParam={setParam}
            onSearch={runSearch}
            onCancel={onClose}
          />
        ) : phase === 'searching' ? (
          <SearchingState
            note={
              task?.current_artist || task?.current_album
                ? `Searching ${task.current_artist} — ${task.current_album}…`
                : undefined
            }
          />
        ) : phase === 'error' ? (
          <div className="modal-body">
            <div className="error">{error || 'Identification failed.'}</div>
            <div className="modal-foot">
              <div className="row-end">
                <button className="btn btn-ghost" onClick={() => setPhase('form')}>
                  <Icon name="edit" size={12} /> Back to search
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="identify-summary">
              <div className="identify-summary-text">
                <span className="muted small">Searching as</span>
                {summary.length === 0 ? (
                  <span className="identify-summary-pill identify-summary-pill-auto">
                    using file tags ·{' '}
                    <span className="mono">
                      {artistName} — {albumTitle}
                    </span>
                  </span>
                ) : (
                  summary.map(([k, v]) => (
                    <span key={k} className="identify-summary-pill">
                      <span className="identify-summary-pill-k">{k}</span>
                      <span className="identify-summary-pill-v mono">{v}</span>
                    </span>
                  ))
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPhase('form')}>
                <Icon name="edit" size={12} /> Refine search
              </button>
            </div>

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
                      className={'candidate' + (picked === i ? ' candidate-active' : '')}
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
                          {c.media && c.track_count ? <span className="dot">·</span> : null}
                          <span>{c.track_count} tracks</span>
                          {c.data_source ? (
                            <>
                              <span className="dot">·</span>
                              <span>{c.data_source}</span>
                            </>
                          ) : null}
                        </div>
                        {c.label ? (
                          <div className="candidate-meta candidate-meta-faint">{c.label}</div>
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
                      <div key={row.field} className={'diff-row diff-row-' + row.status}>
                        <span className="diff-field">{row.field}</span>
                        <span className="diff-cells">
                          <span className="diff-before">
                            {row.current === '—' ? <span className="muted">empty</span> : row.current}
                          </span>
                          <span className="diff-arrow">
                            <Icon name="chevron" size={10} />
                          </span>
                          <span className="diff-after">
                            {row.proposed === '—' ? <span className="muted">remove</span> : row.proposed}
                          </span>
                        </span>
                        <span className="diff-tag">
                          {row.status === 'same' && (
                            <span className="diff-tag-same">unchanged</span>
                          )}
                          {row.status === 'add' && <span className="diff-tag-add">+ add</span>}
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
                    <span className="mono">{String(candidate.mb_albumid).slice(0, 8)}…</span>
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
                  {confirming ? 'Applying…' : `Apply ${changeCount} change${changeCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
