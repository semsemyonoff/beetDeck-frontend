import { describe, it, expect } from 'vitest';
import { basename, fmtMins, fmtTotal, parseLength, discStats, groupByDisc } from './disc.js';

describe('basename', () => {
  it('returns last path segment', () => {
    expect(basename('/music/artist/album')).toBe('album');
  });

  it('handles trailing slash gracefully', () => {
    expect(basename('/a/b/')).toBe('b');
  });

  it('returns empty string for null/undefined', () => {
    expect(basename(null)).toBe('');
    expect(basename(undefined)).toBe('');
    expect(basename('')).toBe('');
  });
});

describe('parseLength', () => {
  it('parses m:ss format', () => {
    expect(parseLength('3:45')).toBe(225);
  });

  it('parses 0:30', () => {
    expect(parseLength('0:30')).toBe(30);
  });

  it('returns 0 for null/empty', () => {
    expect(parseLength(null)).toBe(0);
    expect(parseLength('')).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseLength('abc')).toBe(0);
  });

  it('zero-pad minutes work', () => {
    expect(parseLength('10:05')).toBe(605);
  });
});

describe('fmtMins', () => {
  it('rounds seconds to minutes', () => {
    expect(fmtMins(90)).toBe('2 min');
    expect(fmtMins(60)).toBe('1 min');
  });

  it('handles 0', () => {
    expect(fmtMins(0)).toBe('0 min');
  });

  it('rounds to nearest minute', () => {
    expect(fmtMins(89)).toBe('1 min');
    expect(fmtMins(91)).toBe('2 min');
  });
});

describe('fmtTotal', () => {
  it('floors seconds to minutes', () => {
    expect(fmtTotal(90)).toBe('1 min');
    expect(fmtTotal(119)).toBe('1 min');
    expect(fmtTotal(120)).toBe('2 min');
  });

  it('returns 0 min for falsy input', () => {
    expect(fmtTotal(0)).toBe('0 min');
    expect(fmtTotal(null)).toBe('0 min');
  });
});

describe('discStats', () => {
  const discs = [
    { disc: 1, track_count: 10, duration_sec: 2400, dir: '/music/album/CD1' },
    { disc: 2, track_count: 8, duration_sec: 1800, dir: '/music/album/CD2' },
  ];

  it('maps each disc to a stat entry', () => {
    const stats = discStats(discs);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({
      disc: 1,
      count: 10,
      sec: 2400,
      dirName: 'CD1',
    });
    expect(stats[0].mins).toBe(40);
  });

  it('falls back to CDN when dir is absent', () => {
    const stats = discStats([{ disc: 2, track_count: 5, duration_sec: 600, dir: null }]);
    expect(stats[0].dirName).toBe('CD2');
  });

  it('returns empty array for empty input', () => {
    expect(discStats([])).toEqual([]);
    expect(discStats(null)).toEqual([]);
  });
});

describe('groupByDisc', () => {
  const stats = [
    { disc: 1, count: 2, mins: 5, sec: 300, dirName: 'CD1' },
    { disc: 2, count: 2, mins: 4, sec: 240, dirName: 'CD2' },
  ];
  const tracks = [
    { id: 1, disc: 1, title: 'A' },
    { id: 2, disc: 1, title: 'B' },
    { id: 3, disc: 2, title: 'C' },
    { id: 4, disc: 2, title: 'D' },
  ];

  it('assigns tracks to the correct disc', () => {
    const groups = groupByDisc(tracks, stats);
    expect(groups).toHaveLength(2);
    expect(groups[0].tracks.map((t) => t.id)).toEqual([1, 2]);
    expect(groups[1].tracks.map((t) => t.id)).toEqual([3, 4]);
  });

  it('single-disc fallback when stats is empty', () => {
    const groups = groupByDisc(tracks, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].disc).toBe(1);
    expect(groups[0].tracks).toHaveLength(4);
  });

  it('defaults missing disc field to 1', () => {
    const noDiscTracks = [{ id: 10, title: 'X' }, { id: 11, title: 'Y' }];
    const singleStat = [{ disc: 1, count: 2, mins: 0, sec: 0, dirName: '' }];
    const groups = groupByDisc(noDiscTracks, singleStat);
    expect(groups[0].tracks).toHaveLength(2);
  });
});
