import { describe, it, expect } from 'vitest';
import {
  distanceToScore,
  buildDiffRows,
  buildAlbumDiffRows,
  buildLyricsPreview,
  buildLyricsLineDiff,
} from './diff.js';

describe('distanceToScore', () => {
  it('distance 0 = score 100', () => {
    expect(distanceToScore(0)).toBe(100);
  });

  it('distance 1 = score 0', () => {
    expect(distanceToScore(1)).toBe(0);
  });

  it('distance 0.05 = score 95 (95/85 threshold)', () => {
    expect(distanceToScore(0.05)).toBe(95);
  });

  it('distance 0.15 = score 85 (85 threshold)', () => {
    expect(distanceToScore(0.15)).toBe(85);
  });

  it('distance 0.5 = score 50', () => {
    expect(distanceToScore(0.5)).toBe(50);
  });

  it('clamps negative distance to 0 (score 100)', () => {
    expect(distanceToScore(-0.5)).toBe(100);
  });

  it('clamps distance > 1 to 1 (score 0)', () => {
    expect(distanceToScore(1.5)).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(distanceToScore('foo')).toBe(0);
    expect(distanceToScore(null)).toBe(0);
    expect(distanceToScore(undefined)).toBe(0);
  });
});

describe('buildDiffRows', () => {
  it('returns empty array for null input', () => {
    expect(buildDiffRows(null)).toEqual([]);
  });

  it('classifies same values as same', () => {
    const rows = buildDiffRows({ album: { title: { old: 'X', new: 'X' } } });
    expect(rows[0].status).toBe('same');
    expect(rows[0].current).toBe('X');
    expect(rows[0].proposed).toBe('X');
  });

  it('classifies empty old as add', () => {
    const rows = buildDiffRows({
      album: { title: { old: '', new: 'New Title' } },
    });
    expect(rows[0].status).toBe('add');
    expect(rows[0].current).toBe('—');
    expect(rows[0].proposed).toBe('New Title');
  });

  it('classifies differing values as change', () => {
    const rows = buildDiffRows({
      album: { title: { old: 'Old', new: 'New' } },
    });
    expect(rows[0].status).toBe('change');
  });

  it('adds tracks summary row when tracks are present', () => {
    const applyData = {
      album: {},
      tracks: [
        { title: { old: 'A', new: 'A' }, artist: { old: 'B', new: 'B' } },
        { title: { old: 'C', new: 'D' }, artist: { old: 'E', new: 'E' } },
      ],
    };
    const rows = buildDiffRows(applyData);
    const tracksRow = rows.find((r) => r.field === 'tracks');
    expect(tracksRow).toBeDefined();
    expect(tracksRow.status).toBe('change');
    expect(tracksRow.proposed).toBe('1 updated');
  });

  it('tracks row is same when no tracks changed', () => {
    const applyData = {
      album: {},
      tracks: [{ title: { old: 'A', new: 'A' } }],
    };
    const rows = buildDiffRows(applyData);
    const tracksRow = rows.find((r) => r.field === 'tracks');
    expect(tracksRow.status).toBe('same');
    expect(tracksRow.proposed).toBe('unchanged');
  });

  it('changeCount matches non-same rows', () => {
    const rows = buildDiffRows({
      album: {
        title: { old: 'A', new: 'B' },
        year: { old: '1994', new: '1994' },
      },
    });
    const changeCount = rows.filter((r) => r.status !== 'same').length;
    expect(changeCount).toBe(1);
  });
});

describe('buildAlbumDiffRows', () => {
  it('returns empty array for null input', () => {
    expect(buildAlbumDiffRows(null)).toEqual([]);
  });

  it('classifies fields correctly', () => {
    const album = {
      title: { old: '', new: 'New Album' },
      year: { old: '1990', new: '1994' },
      label: { old: 'A', new: 'A' },
    };
    const rows = buildAlbumDiffRows(album);
    const byField = Object.fromEntries(rows.map((r) => [r.field, r]));
    expect(byField.title.status).toBe('add');
    expect(byField.year.status).toBe('change');
    expect(byField.label.status).toBe('same');
  });
});

describe('buildLyricsPreview', () => {
  it('empty current + found lyrics = change', () => {
    const p = buildLyricsPreview('', 'verse 1\nverse 2');
    expect(p.old).toBe('');
    expect(p.new).toBe('verse 1\nverse 2');
    expect(p.hasChange).toBe(true);
  });

  it('existing lyrics replaced with new lyrics = change', () => {
    const p = buildLyricsPreview('old lyrics', 'new lyrics');
    expect(p.old).toBe('old lyrics');
    expect(p.new).toBe('new lyrics');
    expect(p.hasChange).toBe(true);
  });

  it('identical lyrics = no-op (hasChange false)', () => {
    const p = buildLyricsPreview('same lyrics', 'same lyrics');
    expect(p.old).toBe('same lyrics');
    expect(p.new).toBe('same lyrics');
    expect(p.hasChange).toBe(false);
  });

  it('trims surrounding whitespace when comparing', () => {
    const p = buildLyricsPreview('  same  ', 'same');
    expect(p.hasChange).toBe(false);
    expect(p.old).toBe('same');
  });

  it('handles null/undefined gracefully', () => {
    const p = buildLyricsPreview(null, null);
    expect(p.old).toBe('');
    expect(p.new).toBe('');
    expect(p.hasChange).toBe(false);
  });
});

describe('buildLyricsLineDiff', () => {
  const types = (lines) => lines.map((l) => l.type);
  const texts = (lines) => lines.map((l) => l.text);

  it('empty current → every new line is added', () => {
    const d = buildLyricsLineDiff('', 'verse 1\nverse 2');
    expect(d.old).toEqual([]);
    expect(texts(d.new)).toEqual(['verse 1', 'verse 2']);
    expect(types(d.new)).toEqual(['added', 'added']);
    expect(d.hasChange).toBe(true);
  });

  it('identical lyrics → all lines same, no change', () => {
    const d = buildLyricsLineDiff('a\nb\nc', 'a\nb\nc');
    expect(types(d.old)).toEqual(['same', 'same', 'same']);
    expect(types(d.new)).toEqual(['same', 'same', 'same']);
    expect(d.hasChange).toBe(false);
  });

  it('keeps unchanged lines paired and marks only the edited line', () => {
    const d = buildLyricsLineDiff('a\nold\nc', 'a\nnew\nc');
    // old pane: a(same), old(removed), c(same)
    expect(types(d.old)).toEqual(['same', 'removed', 'same']);
    expect(texts(d.old)).toEqual(['a', 'old', 'c']);
    // new pane: a(same), new(added), c(same)
    expect(types(d.new)).toEqual(['same', 'added', 'same']);
    expect(texts(d.new)).toEqual(['a', 'new', 'c']);
    expect(d.hasChange).toBe(true);
  });

  it('detects an inserted line as added without disturbing neighbors', () => {
    const d = buildLyricsLineDiff('a\nb', 'a\nx\nb');
    expect(types(d.new)).toEqual(['same', 'added', 'same']);
    expect(types(d.old)).toEqual(['same', 'same']);
  });

  it('trims surrounding whitespace before diffing', () => {
    const d = buildLyricsLineDiff('  a\nb  ', 'a\nb');
    expect(d.hasChange).toBe(false);
    expect(types(d.old)).toEqual(['same', 'same']);
  });

  it('handles null/undefined gracefully', () => {
    const d = buildLyricsLineDiff(null, null);
    expect(d.old).toEqual([]);
    expect(d.new).toEqual([]);
    expect(d.hasChange).toBe(false);
  });

  it('parses LRC timecodes into a ts field, separate from the text', () => {
    const d = buildLyricsLineDiff('[00:13.22]hello', '[00:13.22]hello');
    expect(d.old[0]).toEqual({ ts: '00:13.22', text: 'hello', type: 'same' });
    expect(d.new[0]).toEqual({ ts: '00:13.22', text: 'hello', type: 'same' });
  });

  it('diffs synced lyrics on words, ignoring drifting timecodes', () => {
    const d = buildLyricsLineDiff(
      '[00:01.00]a\n[00:02.00]old',
      '[00:01.50]a\n[00:02.50]new'
    );
    // line 1 text identical despite differing timecodes → same (no highlight)
    expect(d.old[0].type).toBe('same');
    expect(d.new[0].type).toBe('same');
    // line 2 text changed → removed / added
    expect(types(d.old)).toEqual(['same', 'removed']);
    expect(types(d.new)).toEqual(['same', 'added']);
  });
});
