import { describe, it, expect } from 'vitest';
import {
  buildScanSummary,
  scanProgressPct,
  isIndeterminate,
  buildScanViewModel,
  classifyLogLevel,
  applyLogChunk,
  parseLogLines,
  formatRunDate,
} from './scan.js';

describe('buildScanSummary', () => {
  it('counts added and removed item arrays', () => {
    const d = {
      added: [{ id: 1 }, { id: 2 }, { id: 3 }],
      removed: [{ id: 9 }],
    };
    expect(buildScanSummary(d)).toEqual({ added: 3, removed: 1 });
  });

  it('treats empty arrays as zero counts', () => {
    expect(buildScanSummary({ added: [], removed: [] })).toEqual({
      added: 0,
      removed: 0,
    });
  });

  it('defaults removed to 0 when missing', () => {
    expect(buildScanSummary({ added: [{ id: 1 }] })).toEqual({
      added: 1,
      removed: 0,
    });
  });

  it('returns null when no diff is present (no snapshot)', () => {
    expect(buildScanSummary({ status: 'done', returncode: 0 })).toBeNull();
  });

  it('returns null for nullish input', () => {
    expect(buildScanSummary(null)).toBeNull();
    expect(buildScanSummary(undefined)).toBeNull();
  });

  it('returns null when added is not an array (e.g. legacy number shape)', () => {
    expect(buildScanSummary({ added: 3, removed: 1 })).toBeNull();
  });
});

describe('scanProgressPct', () => {
  it('computes percent for normal values', () => {
    expect(scanProgressPct(5, 10)).toBe(50);
    expect(scanProgressPct(1, 4)).toBe(25);
    expect(scanProgressPct(10, 10)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(scanProgressPct(1, 3)).toBe(33);
    expect(scanProgressPct(2, 3)).toBe(67);
  });

  it('returns 0 when total is null (indeterminate)', () => {
    expect(scanProgressPct(5, null)).toBe(0);
  });

  it('returns 0 when total is zero (guard against division by zero)', () => {
    expect(scanProgressPct(0, 0)).toBe(0);
  });

  it('caps at 100 when processed exceeds total', () => {
    expect(scanProgressPct(12, 10)).toBe(100);
  });

  it('returns 0 when processed is 0', () => {
    expect(scanProgressPct(0, 20)).toBe(0);
  });
});

describe('isIndeterminate', () => {
  it('returns true when total is null', () => {
    expect(isIndeterminate(null)).toBe(true);
  });

  it('returns true when total is undefined', () => {
    expect(isIndeterminate(undefined)).toBe(true);
  });

  it('returns false when total is a number', () => {
    expect(isIndeterminate(10)).toBe(false);
    expect(isIndeterminate(0)).toBe(false);
  });
});

describe('buildScanViewModel', () => {
  it('returns null for idle phase', () => {
    expect(buildScanViewModel({ phase: 'idle' })).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(buildScanViewModel(null)).toBeNull();
    expect(buildScanViewModel(undefined)).toBeNull();
  });

  it('returns null when phase is missing', () => {
    expect(buildScanViewModel({ processed: 0 })).toBeNull();
  });

  it('maps importing phase to running state, full mode when total is set', () => {
    const vm = buildScanViewModel({
      phase: 'importing',
      processed: 3,
      total: 10,
      current_item: '/music/Artist/Album',
      run_id: '20260628-120000',
      added: [{ id: 1 }],
      removed: [],
    });
    expect(vm).toEqual({
      state: 'running',
      phase: 'importing',
      mode: 'full',
      processed: 3,
      total: 10,
      currentItem: '/music/Artist/Album',
      runId: '20260628-120000',
      added: 1,
      removed: 0,
    });
  });

  it('maps quick scan (total null) to indeterminate mode', () => {
    const vm = buildScanViewModel({
      phase: 'importing',
      processed: 5,
      total: null,
      current_item: null,
      run_id: '20260628-130000',
      added: [],
      removed: [],
    });
    expect(vm.mode).toBe('quick');
    expect(vm.state).toBe('running');
    expect(vm.total).toBeNull();
  });

  it('maps updating phase to running state', () => {
    const vm = buildScanViewModel({
      phase: 'updating',
      processed: 10,
      total: 10,
      current_item: null,
      run_id: 'x',
      added: [{ id: 1 }, { id: 2 }],
      removed: [{ id: 3 }],
    });
    expect(vm.state).toBe('running');
    expect(vm.phase).toBe('updating');
    expect(vm.added).toBe(2);
    expect(vm.removed).toBe(1);
  });

  it('maps done phase to done state', () => {
    const vm = buildScanViewModel({
      phase: 'done',
      processed: 10,
      total: 10,
      current_item: null,
      run_id: 'x',
      added: [],
      removed: [],
    });
    expect(vm.state).toBe('done');
  });

  it('maps error phase to error state', () => {
    const vm = buildScanViewModel({
      phase: 'error',
      processed: 3,
      total: 10,
      current_item: null,
      run_id: 'x',
      added: [],
      removed: [],
    });
    expect(vm.state).toBe('error');
  });

  it('defaults processed to 0 when missing', () => {
    const vm = buildScanViewModel({ phase: 'importing', run_id: 'x' });
    expect(vm.processed).toBe(0);
  });

  it('treats missing added/removed as 0', () => {
    const vm = buildScanViewModel({ phase: 'importing', run_id: 'x' });
    expect(vm.added).toBe(0);
    expect(vm.removed).toBe(0);
  });

  it('treats non-array added/removed as 0', () => {
    const vm = buildScanViewModel({
      phase: 'done',
      added: 3,
      removed: 1,
      run_id: 'x',
    });
    expect(vm.added).toBe(0);
    expect(vm.removed).toBe(0);
  });
});

describe('applyLogChunk', () => {
  it('appends text from chunk to rawText', () => {
    const state = { rawText: 'hello\n', offset: 6 };
    const chunk = { text: 'world\n', offset: 12 };
    expect(applyLogChunk(state, chunk)).toEqual({
      rawText: 'hello\nworld\n',
      offset: 12,
    });
  });

  it('uses new offset from chunk', () => {
    const state = { rawText: '', offset: 0 };
    const chunk = { text: 'line\n', offset: 5 };
    expect(applyLogChunk(state, chunk).offset).toBe(5);
  });

  it('keeps old offset when chunk offset is not a number', () => {
    const state = { rawText: 'a', offset: 10 };
    const chunk = { text: 'b', offset: null };
    expect(applyLogChunk(state, chunk).offset).toBe(10);
  });

  it('handles empty chunk text (no new data)', () => {
    const state = { rawText: 'existing', offset: 8 };
    const chunk = { text: '', offset: 8 };
    expect(applyLogChunk(state, chunk)).toEqual({
      rawText: 'existing',
      offset: 8,
    });
  });

  it('handles null/undefined chunk gracefully', () => {
    const state = { rawText: 'x', offset: 1 };
    expect(applyLogChunk(state, null)).toEqual({ rawText: 'x', offset: 1 });
    expect(applyLogChunk(state, undefined)).toEqual({
      rawText: 'x',
      offset: 1,
    });
  });

  it('accumulates across multiple sequential calls', () => {
    let state = { rawText: '', offset: 0 };
    state = applyLogChunk(state, { text: 'first\n', offset: 6 });
    state = applyLogChunk(state, { text: 'second\n', offset: 13 });
    state = applyLogChunk(state, { text: '', offset: 13 });
    expect(state).toEqual({ rawText: 'first\nsecond\n', offset: 13 });
  });
});

describe('parseLogLines', () => {
  it('returns empty array for empty/null input', () => {
    expect(parseLogLines('')).toEqual([]);
    expect(parseLogLines(null)).toEqual([]);
    expect(parseLogLines(undefined)).toEqual([]);
  });

  it('splits text into lines and assigns level + line number', () => {
    const result = parseLogLines(
      'Looking up: /music/A\ndeleting duplicate /x\n'
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: 'Looking up: /music/A',
      date: null,
      time: null,
      level: 'info',
      n: 1,
    });
    expect(result[1]).toEqual({
      text: 'deleting duplicate /x',
      date: null,
      time: null,
      level: 'removed',
      n: 2,
    });
  });

  it('parses the "[date time] " prefix and classifies the stripped message', () => {
    const result = parseLogLines(
      '[2026-06-28 14:30:52] Replacing item 1: /x.flac\n' +
        '[2026-06-28 14:30:53] deleting duplicate /old.mp3\n'
    );
    expect(result[0]).toEqual({
      text: 'Replacing item 1: /x.flac',
      date: '2026-06-28',
      time: '14:30:52',
      level: 'added',
      n: 1,
    });
    expect(result[1]).toEqual({
      text: 'deleting duplicate /old.mp3',
      date: '2026-06-28',
      time: '14:30:53',
      level: 'removed',
      n: 2,
    });
  });

  it('filters out blank lines', () => {
    const result = parseLogLines('line1\n\nline3\n');
    expect(result).toHaveLength(2);
    expect(result[0].n).toBe(1);
    expect(result[1].n).toBe(2);
  });

  it('classifies added/removed/warn/skip/summary lines correctly', () => {
    const raw = [
      'Replacing item 1: /x.flac',
      'deleting duplicate /old.mp3',
      'No files imported from /empty',
      'importer.session: skip /x',
      'Skipped 3 paths.',
    ].join('\n');
    const lines = parseLogLines(raw);
    expect(lines[0].level).toBe('added');
    expect(lines[1].level).toBe('removed');
    expect(lines[2].level).toBe('warn');
    expect(lines[3].level).toBe('skip');
    expect(lines[4].level).toBe('summary');
  });

  it('assigns sequential line numbers starting at 1', () => {
    const result = parseLogLines('a\nb\nc\n');
    expect(result.map((l) => l.n)).toEqual([1, 2, 3]);
  });
});

describe('classifyLogLevel', () => {
  it('returns info for empty/null input', () => {
    expect(classifyLogLevel('')).toBe('info');
    expect(classifyLogLevel(null)).toBe('info');
    expect(classifyLogLevel(undefined)).toBe('info');
  });

  it('classifies Looking up: as info', () => {
    expect(classifyLogLevel('Looking up: /music/Artist/Album')).toBe('info');
  });

  it('classifies generic lines as info', () => {
    expect(classifyLogLevel('musicbrainz: Fetching album')).toBe('info');
    expect(classifyLogLevel('  /path/to/track.mp3')).toBe('info');
  });

  // added
  it('classifies Replacing item as added', () => {
    expect(classifyLogLevel('Replacing item 42: /music/track.mp3')).toBe(
      'added'
    );
  });

  it('classifies duplicate-replace session log as added', () => {
    expect(
      classifyLogLevel('importer.session: duplicate-replace /music/track.flac')
    ).toBe('added');
  });

  // removed
  it('classifies deleting duplicate as removed', () => {
    expect(classifyLogLevel('deleting duplicate /music/track.mp3')).toBe(
      'removed'
    );
  });

  it('classifies removing N old duplicate albums as removed', () => {
    expect(classifyLogLevel('removing 2 old duplicate albums')).toBe('removed');
  });

  it('classifies "  deleted" (beet update) as removed', () => {
    expect(classifyLogLevel('  deleted')).toBe('removed');
  });

  // skip
  it('classifies skip session log as skip', () => {
    expect(
      classifyLogLevel('importer.session: skip /music/Skipped/Album')
    ).toBe('skip');
  });

  it('classifies duplicate-skip session log as skip', () => {
    expect(
      classifyLogLevel('importer.session: duplicate-skip /music/Dup/Album')
    ).toBe('skip');
  });

  // summary
  it('classifies Skipped N paths as summary', () => {
    expect(classifyLogLevel('Skipped 17 paths.')).toBe('summary');
  });

  // warn
  it('classifies No files imported as warn', () => {
    expect(classifyLogLevel('No files imported from /music/Empty')).toBe(
      'warn'
    );
  });

  it('classifies Resuming interrupted import as warn', () => {
    expect(
      classifyLogLevel('Resuming interrupted import of /music/Album')
    ).toBe('warn');
  });

  it('classifies error reading as warn', () => {
    expect(
      classifyLogLevel('error reading /music/bad.mp3: Permission denied')
    ).toBe('warn');
  });

  it('strips ANSI escape codes before classifying', () => {
    expect(classifyLogLevel('\x1b[31mNo files imported from /x\x1b[0m')).toBe(
      'warn'
    );
    expect(classifyLogLevel('\x1b[32m  deleted\x1b[0m')).toBe('removed');
  });
});

describe('formatRunDate', () => {
  it('formats the date portion of a run_id as YYYY-MM-DD', () => {
    expect(formatRunDate('20260628-143052-123456')).toBe('2026-06-28');
  });

  it('returns "" for missing or malformed run_id', () => {
    expect(formatRunDate(null)).toBe('');
    expect(formatRunDate(undefined)).toBe('');
    expect(formatRunDate('')).toBe('');
    expect(formatRunDate('not-a-run-id')).toBe('');
  });
});
