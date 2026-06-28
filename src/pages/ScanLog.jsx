import { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import Segmented from '../ui/Segmented.jsx';
import { navigate } from '../useHashRoute.js';
import { applyLogChunk, parseLogLines } from '../lib/scan.js';

function ScanProgressSummary({ scan }) {
  if (!scan) return null;
  const running = scan.state === 'running';
  const error = scan.state === 'error';
  const pct = scan.total
    ? Math.round((scan.processed / scan.total) * 100)
    : 100;
  const indet = running && scan.mode !== 'full';

  return (
    <div className="scan-summary">
      <div className="scan-summary-row">
        <span
          className={
            'scan-summary-state scan-summary-' +
            (running ? 'running' : error ? 'error' : 'done')
          }
        >
          {running ? (
            <>
              <span className="scan-spin" aria-hidden="true" />{' '}
              {scan.mode === 'full' ? scan.phase : 'Processing'}
            </>
          ) : error ? (
            <>
              <Icon name="alert" size={12} /> Failed
            </>
          ) : (
            <>
              <Icon name="check" size={12} /> Complete
            </>
          )}
        </span>
        {running && scan.mode === 'full' ? (
          <span className="scan-summary-count mono">
            {scan.processed}/{scan.total} · {pct}%
          </span>
        ) : running ? (
          <span className="scan-summary-count mono">{scan.processed} done</span>
        ) : null}
        <span className="scan-summary-counts">
          <span className="ok mono">+{scan.added}</span>
          <span className="warn mono">−{scan.removed}</span>
        </span>
      </div>
      <div className={'scan-progress' + (indet ? ' scan-progress-indet' : '')}>
        <div
          className="scan-progress-fill"
          style={{
            width: running
              ? scan.mode === 'full'
                ? pct + '%'
                : undefined
              : '100%',
          }}
        />
      </div>
    </div>
  );
}

export default function ScanLog({ scan }) {
  const [lvl, setLvl] = useState('all');
  const [logState, setLogState] = useState({ rawText: '', offset: 0 });
  const logRef = useRef(null);
  const offsetRef = useRef(0);
  const finishedRef = useRef(false);
  const runId = scan?.runId ?? null;
  const finished = scan?.state === 'done' || scan?.state === 'error';
  // Mirror finished-state into a ref so the offset-polling effect (keyed on
  // runId) can see the latest value without re-subscribing and resetting the
  // offset. Updated in an effect — never written during render.
  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  useEffect(() => {
    if (!runId) return;
    offsetRef.current = 0;
    setLogState({ rawText: '', offset: 0 });
    let stopped = false;

    const fetchChunk = async () => {
      if (stopped) return;
      try {
        const r = await fetch(
          `/api/rescan/log?run_id=${encodeURIComponent(runId)}&offset=${offsetRef.current}`
        );
        if (!r.ok || stopped) return;
        const chunk = await r.json();
        setLogState((prev) => {
          const next = applyLogChunk(prev, chunk);
          offsetRef.current = next.offset;
          return next;
        });
      } catch {
        // best effort — network errors are transient
      }
    };

    fetchChunk();
    // Poll while the run is live; once it has finished, do one final fetch to
    // flush the tail of the log, then stop (no point polling a static file).
    const id = setInterval(async () => {
      await fetchChunk();
      if (finishedRef.current) clearInterval(id);
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [runId]);

  const running = scan?.state === 'running';

  useEffect(() => {
    if (running && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [running, logState.rawText]);

  const lines = parseLogLines(logState.rawText);
  const filtered = lines.filter((l) => {
    if (lvl === 'changes') return l.level === 'added' || l.level === 'removed';
    if (lvl === 'warnings') return l.level === 'warn' || l.level === 'skip';
    return true;
  });
  const changeCount = lines.filter(
    (l) => l.level === 'added' || l.level === 'removed'
  ).length;
  const warnCount = lines.filter(
    (l) => l.level === 'warn' || l.level === 'skip'
  ).length;

  return (
    <div className="page page-scan">
      <div className="crumbs">
        <button className="crumb" onClick={() => navigate({ name: 'library' })}>
          <Icon name="arrow-left" size={12} /> Library
        </button>
      </div>

      <header className="scan-head">
        <div className="scan-head-text">
          <div className="scan-head-eyebrow">
            <Icon name="scan" size={12} /> Importer · beets
          </div>
          <h1 className="page-title">Scan log</h1>
        </div>
        <ScanProgressSummary scan={scan} />
      </header>

      <div className="scan-log-toolbar">
        <Segmented
          value={lvl}
          onChange={setLvl}
          size="sm"
          options={[
            { value: 'all', label: 'All', badge: lines.length },
            { value: 'changes', label: 'Changes', badge: changeCount },
            { value: 'warnings', label: 'Warnings', badge: warnCount },
          ]}
        />
        <span className="scan-log-status mono small">
          {running ? (
            <>
              <span className="scan-live-dot" aria-hidden="true" /> live ·
              tailing
            </>
          ) : (
            'log ended'
          )}
        </span>
      </div>

      <div className="scan-log" ref={logRef}>
        {filtered.map((l, i) => (
          <div key={i} className={'scan-log-line scan-log-' + l.level}>
            <span className="scan-log-ts mono">
              {String(l.n).padStart(3, '0')}
            </span>
            <span className="scan-log-lvl mono">{l.level}</span>
            <span className="scan-log-msg mono">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
