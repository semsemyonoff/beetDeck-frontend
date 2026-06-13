import { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { navigate } from '../useHashRoute.js';
import { distanceToScore, buildAlbumDiffRows } from '../lib/diff.js';

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

export default function Untagged() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({}); // {id: {title, artist, album}}
  const [selected, setSelected] = useState(() => new Set());
  const [savingId, setSavingId] = useState(null);
  const [flash, setFlash] = useState(null);

  // identify state
  const [phase, setPhase] = useState('idle'); // idle | searching | results | error | confirming | done
  const [override, setOverride] = useState({ artist: '', album: '' });
  const [taskId, setTaskId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState(0);
  const [applyData, setApplyData] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [identifyError, setIdentifyError] = useState(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const r = await fetch('/api/items/untagged');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      setItems(data);
      const e = {};
      for (const it of data)
        e[it.id] = { title: it.title, artist: it.artist, album: it.album };
      setEdits(e);
    } catch (e) {
      setError(String(e));
    }
  };

  const flashTimerRef = useRef(null);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
      window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const setEdit = (id, field, value) =>
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = (on) =>
    setSelected(on && items ? new Set(items.map((i) => i.id)) : new Set());

  const showFlash = (kind, text) => {
    setFlash({ kind, text });
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 2400);
  };

  const saveItem = async (id) => {
    const edit = edits[id] || {};
    setSavingId(id);
    try {
      const r = await fetch(`/api/items/${id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: (edit.title || '').trim(),
          artist: (edit.artist || '').trim(),
          album: (edit.album || '').trim(),
        }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok || !d || d.error) {
        showFlash('err', d?.error || `Save failed (HTTP ${r.status})`);
      } else if (d.warnings && d.warnings.length) {
        showFlash('warn', d.warnings.join('; '));
      } else {
        showFlash('ok', 'Saved');
      }
    } catch (e) {
      showFlash('err', String(e));
    } finally {
      setSavingId(null);
    }
  };

  const startIdentify = async () => {
    const ids = [...selected];
    if (!ids.length) {
      showFlash('err', 'Select at least one item');
      return;
    }
    setIdentifyError(null);
    setApplyData(null);
    setCandidates([]);
    setPicked(0);
    setPhase('searching');
    try {
      const r = await fetch('/api/items/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: ids,
          search_artist: override.artist.trim(),
          search_album: override.album.trim(),
        }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok || !d?.task_id) {
        setIdentifyError(
          d?.error || `Identify start failed (HTTP ${r.status})`
        );
        setPhase('error');
        return;
      }
      setTaskId(d.task_id);
      pollRef.current = window.setTimeout(() => pollStatus(d.task_id), 400);
    } catch (e) {
      setIdentifyError(String(e));
      setPhase('error');
    }
  };

  const pollStatus = async (tid) => {
    try {
      const r = await fetch(`/api/items/identify/${tid}/status`);
      const d = r.ok ? await r.json() : null;
      if (!d) {
        setIdentifyError('Status request failed');
        setPhase('error');
        return;
      }
      if (d.status === 'running' || d.status === 'confirming') {
        pollRef.current = window.setTimeout(() => pollStatus(tid), 1000);
        return;
      }
      if (d.status === 'error') {
        setIdentifyError(d.error || 'Identification failed');
        setPhase('error');
        return;
      }
      if (d.status === 'done') {
        const cands = d.candidates || [];
        if (!cands.length) {
          setIdentifyError('No candidates returned');
          setPhase('error');
          return;
        }
        setCandidates(cands);
        setPicked(0);
        setPhase('results');
        loadApply(tid, 0);
        return;
      }
      setIdentifyError('Task vanished. Try again.');
      setPhase('error');
    } catch (e) {
      setIdentifyError(String(e));
      setPhase('error');
    }
  };

  const loadApply = async (tid, idx) => {
    setApplyLoading(true);
    setApplyData(null);
    try {
      const r = await fetch(`/api/items/identify/${tid}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_index: idx }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok || !d || d.error) {
        setIdentifyError(d?.error || `Apply failed (HTTP ${r.status})`);
      } else {
        setApplyData(d);
      }
    } catch (e) {
      setIdentifyError(String(e));
    } finally {
      setApplyLoading(false);
    }
  };

  const onPick = (idx) => {
    if (idx === picked) return;
    setPicked(idx);
    if (taskId) loadApply(taskId, idx);
  };

  const confirm = async () => {
    if (!taskId) return;
    setPhase('confirming');
    setIdentifyError(null);
    try {
      const r = await fetch(`/api/items/identify/${taskId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_index: picked }),
      });
      const d = r.ok ? await r.json() : null;
      if (!r.ok || !d || d.error) {
        setIdentifyError(d?.error || `Confirm failed (HTTP ${r.status})`);
        setPhase('results');
        return;
      }
      setPhase('done');
      setTimeout(() => {
        if (d.album_id) navigate({ name: 'album', id: d.album_id });
        else navigate({ name: 'library' });
      }, 900);
    } catch (e) {
      setIdentifyError(String(e));
      setPhase('results');
    }
  };

  const resetIdentify = () => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setPhase('idle');
    setTaskId(null);
    setCandidates([]);
    setPicked(0);
    setApplyData(null);
    setIdentifyError(null);
  };

  const candidate = candidates[picked];
  const albumDiffRows = buildAlbumDiffRows(applyData?.album);
  const changeCount = albumDiffRows.filter((r) => r.status !== 'same').length;

  if (error) {
    return (
      <div className="page page-untagged">
        <div className="error">Failed to load: {error}</div>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="page page-untagged">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page page-untagged">
      <div className="crumbs">
        <button className="crumb" onClick={() => navigate({ name: 'library' })}>
          <Icon name="arrow-left" size={12} /> Library
        </button>
      </div>

      <header className="untagged-header">
        <div>
          <div className="page-eyebrow">
            <Icon name="alert" size={12} /> Loose files
          </div>
          <h1 className="page-title">Untagged</h1>
          <p className="muted small">
            Files belonging to albums without an album-artist. Edit a single
            file inline, or pick several and identify them as one album.
          </p>
        </div>
        <div className="untagged-stats">
          <div>
            <strong>{items.length}</strong>
            <span className="muted small"> files</span>
          </div>
          <div>
            <strong>{selected.size}</strong>
            <span className="muted small"> selected</span>
          </div>
        </div>
      </header>

      {flash && <div className={'flash flash-' + flash.kind}>{flash.text}</div>}

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing to clean up</h2>
          <p className="muted">No untagged files found in your library.</p>
        </div>
      ) : (
        <>
          <div className="untagged-toolbar">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => selectAll(true)}
            >
              Select all
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => selectAll(false)}
            >
              Clear
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={
                !selected.size ||
                phase === 'searching' ||
                phase === 'confirming'
              }
              onClick={startIdentify}
            >
              <Icon name="sparkles" size={12} /> Identify selected (
              {selected.size})
            </button>
          </div>

          <div className="untagged-table">
            <div className="untagged-row untagged-row-head">
              <span />
              <span>Title</span>
              <span>Artist</span>
              <span>Album</span>
              <span />
            </div>
            {items.map((it) => {
              const e = edits[it.id] || { title: '', artist: '', album: '' };
              const checked = selected.has(it.id);
              return (
                <div
                  key={it.id}
                  className={
                    'untagged-row' + (checked ? ' untagged-row-on' : '')
                  }
                >
                  <label className="untagged-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(it.id)}
                    />
                  </label>
                  <input
                    className="form-input form-input-sm"
                    value={e.title}
                    placeholder="Title"
                    onChange={(ev) => setEdit(it.id, 'title', ev.target.value)}
                  />
                  <input
                    className="form-input form-input-sm"
                    value={e.artist}
                    placeholder="Artist"
                    onChange={(ev) => setEdit(it.id, 'artist', ev.target.value)}
                  />
                  <input
                    className="form-input form-input-sm"
                    value={e.album}
                    placeholder="Album"
                    onChange={(ev) => setEdit(it.id, 'album', ev.target.value)}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={savingId === it.id}
                    onClick={() => saveItem(it.id)}
                  >
                    {savingId === it.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <section className="untagged-identify">
        <div className="identify-section-head">
          <span className="muted small">Group identify</span>
          {phase !== 'idle' && phase !== 'searching' && (
            <button className="btn btn-ghost btn-sm" onClick={resetIdentify}>
              <Icon name="x" size={12} /> Reset
            </button>
          )}
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">
              Artist <span className="muted xs">(optional override)</span>
            </span>
            <input
              className="form-input"
              value={override.artist}
              placeholder="Override artist search"
              onChange={(e) =>
                setOverride((p) => ({ ...p, artist: e.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span className="form-label">
              Album <span className="muted xs">(optional override)</span>
            </span>
            <input
              className="form-input"
              value={override.album}
              placeholder="Override album search"
              onChange={(e) =>
                setOverride((p) => ({ ...p, album: e.target.value }))
              }
            />
          </label>
        </div>

        {phase === 'searching' && (
          <div className="searching-state">
            <div className="spinner" />
            <div className="muted small">Querying musicbrainz.org…</div>
          </div>
        )}

        {phase === 'error' && (
          <div className="error">
            {identifyError || 'Identification failed.'}
          </div>
        )}

        {phase === 'done' && (
          <div className="flash flash-ok">Album created. Redirecting…</div>
        )}

        {(phase === 'results' || phase === 'confirming') && (
          <>
            {identifyError && <div className="error">{identifyError}</div>}
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
                      </div>
                      {picked === i ? <Icon name="check" size={14} /> : null}
                    </button>
                  );
                })}
              </aside>

              <section className="identify-diff">
                <div className="identify-section-head">
                  <div>
                    <span className="muted small">New album</span>
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
                    {albumDiffRows.map((row) => (
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
              </div>
              <div className="row-end">
                <button
                  className="btn btn-primary"
                  disabled={
                    phase === 'confirming' || applyLoading || !candidate
                  }
                  onClick={confirm}
                >
                  <Icon name="check" size={12} />{' '}
                  {phase === 'confirming'
                    ? 'Creating…'
                    : 'Confirm & create album'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
