// Shape the rescan-status payload into a banner summary.
// The backend `/api/rescan/status` returns `added`/`removed` as arrays of
// item objects ({id, title, artist}); the banner only needs their counts.
// Returns null when no diff is available (no snapshot was taken).
export function buildScanSummary(d) {
  if (!d || !Array.isArray(d.added)) return null;
  return {
    added: d.added.length,
    removed: Array.isArray(d.removed) ? d.removed.length : 0,
  };
}

// Progress percent 0-100. Returns 0 when total is null/zero (indeterminate).
export function scanProgressPct(processed, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
}

// True when total is null — quick mode, denominator unknown.
export function isIndeterminate(total) {
  return total == null;
}

// Map raw /api/rescan/status payload → banner view model.
// Returns null when idle (no active or finished scan to show).
// View model shape matches the prototype's ScanBanner scan prop:
//   { state, mode, phase, processed, total, currentItem, runId, added, removed }
// state: 'running' | 'done' | 'error'
// mode:  'full' (total known) | 'quick' (total null)
export function buildScanViewModel(d) {
  if (!d || !d.phase || d.phase === 'idle') return null;

  const phase = d.phase; // 'importing' | 'updating' | 'done' | 'error'
  const state =
    phase === 'done' ? 'done' : phase === 'error' ? 'error' : 'running';
  const mode = d.total != null ? 'full' : 'quick';

  return {
    state,
    phase,
    mode,
    processed: d.processed ?? 0,
    total: d.total ?? null,
    currentItem: d.current_item ?? null,
    runId: d.run_id ?? null,
    added: Array.isArray(d.added) ? d.added.length : 0,
    removed: Array.isArray(d.removed) ? d.removed.length : 0,
  };
}

// Accumulate a chunk from GET /api/rescan/log into running log state.
// Returns new { rawText, offset }.
export function applyLogChunk({ rawText, offset }, chunk) {
  return {
    rawText: rawText + (chunk?.text || ''),
    offset: typeof chunk?.offset === 'number' ? chunk.offset : offset,
  };
}

// Matches the backend's per-line log framing: "[YYYY-MM-DD HH:MM:SS] <msg>".
// Kept in sync with _LOG_TS_FMT in services/backend/src/beetdeck/routes/scan.py.
// Capture groups: 1=date (YYYY-MM-DD), 2=time (HH:MM:SS), 3=message.
const LOG_TS_RE = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\] ([\s\S]*)$/;

// Split accumulated raw log text into display lines with classified levels.
// Each line may carry a "[date time] " prefix written by the backend; it is
// parsed out into { date, time } and stripped before classification. Lines from
// older (un-prefixed) runs fall back to date=time=null with the full text kept.
export function parseLogLines(rawText) {
  if (!rawText) return [];
  return rawText
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      const m = LOG_TS_RE.exec(line);
      const date = m ? m[1] : null;
      const time = m ? m[2] : null;
      const text = m ? m[3] : line;
      return {
        text,
        date,
        time,
        level: classifyLogLevel(text),
        n: i + 1,
      };
    });
}

// Derive the scan's calendar date (YYYY-MM-DD) from a run_id, which the backend
// builds from the scan start time as "YYYYMMDD-HHMMSS-ffffff". Returns '' when
// the run_id is missing or malformed. Avoids locale/timezone ambiguity by
// reformatting the already-local digits rather than constructing a Date.
export function formatRunDate(runId) {
  if (!runId) return '';
  const m = /^(\d{4})(\d{2})(\d{2})-/.exec(runId);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// Classify a raw beets verbose log line into a UI level.
// Mirrors the backend parse_beets_line() patterns (beets 2.12.0).
// Levels: info | added | removed | warn | skip | summary
export function classifyLogLevel(text) {
  if (!text) return 'info';

  const t = text
    .replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'), '')
    .replace(/\r?\n$/, '');

  // added
  if (t.startsWith('Replacing item ')) return 'added';
  if (t.includes('importer.session: duplicate-replace ')) return 'added';

  // removed
  if (t.startsWith('deleting duplicate ')) return 'removed';
  if (t.startsWith('removing ') && t.includes('duplicate')) return 'removed';
  if (t === '  deleted' || t.trimEnd() === '  deleted') return 'removed';

  // skip
  if (
    t.includes('importer.session: skip ') ||
    t.includes('importer.session: duplicate-skip ')
  )
    return 'skip';

  // summary
  if (t.startsWith('Skipped ') && t.includes('paths')) return 'summary';

  // warn
  if (t.startsWith('No files imported from ')) return 'warn';
  if (t.includes('Resuming interrupted import')) return 'warn';
  if (t.startsWith('error reading ')) return 'warn';

  return 'info';
}
