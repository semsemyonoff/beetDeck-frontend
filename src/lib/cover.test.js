import { describe, expect, it } from 'vitest';

import { compareCoverSize, formatDimensions } from './cover';

describe('formatDimensions', () => {
  it.each([
    [1200, 1200, '1200×1200'],
    [495, 500, '495×500'],
  ])('renders %i×%i', (width, height, expected) => {
    expect(formatDimensions(width, height)).toBe(expected);
  });

  it.each([
    [null, 500],
    [500, null],
    [0, 0],
    [undefined, undefined],
  ])('returns null for (%s, %s)', (width, height) => {
    expect(formatDimensions(width, height)).toBeNull();
  });
});

describe('compareCoverSize', () => {
  const candidate = { width: 1000, height: 1000 };

  it('calls a bigger candidate larger', () => {
    expect(compareCoverSize({ width: 500, height: 500 }, candidate)).toBe(
      'larger'
    );
  });

  it('calls a smaller candidate smaller', () => {
    expect(compareCoverSize({ width: 1200, height: 1200 }, candidate)).toBe(
      'smaller'
    );
  });

  it('compares by area, not by width', () => {
    // Narrower but taller, and the bigger picture overall.
    expect(compareCoverSize({ width: 1200, height: 600 }, candidate)).toBe(
      'larger'
    );
  });

  it('reports an equal size as same', () => {
    expect(compareCoverSize({ width: 1000, height: 1000 }, candidate)).toBe(
      'same'
    );
  });

  it('reports new when the album has no cover', () => {
    expect(compareCoverSize(null, candidate)).toBe('new');
    expect(compareCoverSize({ width: null, height: null }, candidate)).toBe(
      'new'
    );
  });

  it('separates an unmeasurable cover from no cover at all', () => {
    // The backend sends null for both; only the album's has_cover flag tells
    // them apart, and calling the first "no cover" invites a downgrade.
    expect(
      compareCoverSize({ width: null, height: null }, candidate, {
        hasCurrent: true,
      })
    ).toBe('unknown');
  });

  it('claims nothing when the candidate size is unknown', () => {
    expect(compareCoverSize({ width: 500, height: 500 }, null)).toBeNull();
    expect(
      compareCoverSize({ width: 500, height: 500 }, { width: 0, height: 0 })
    ).toBeNull();
  });
});
