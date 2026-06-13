import { describe, it, expect } from 'vitest';
import { buildScanSummary } from './scan.js';

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
