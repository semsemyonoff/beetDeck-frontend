import { describe, it, expect } from 'vitest';
import { mapAlbum, isIdentified, needsReview } from './albums.js';

describe('mapAlbum', () => {
  it('maps API shape to internal shape', () => {
    const api = {
      id: 1,
      album: 'Dummy',
      year: 1994,
      has_cover: true,
      tagged: true,
      ignored: false,
    };
    const result = mapAlbum(api);
    expect(result).toEqual({
      id: 1,
      title: 'Dummy',
      year: 1994,
      has_cover: true,
      tagged: true,
      ignored: false,
      identified: true,
    });
  });

  it('sets identified true when tagged', () => {
    expect(mapAlbum({ tagged: true, ignored: false }).identified).toBe(true);
  });

  it('sets identified true when ignored', () => {
    expect(mapAlbum({ tagged: false, ignored: true }).identified).toBe(true);
  });

  it('sets identified false when neither tagged nor ignored', () => {
    expect(mapAlbum({ tagged: false, ignored: false }).identified).toBe(false);
  });
});

describe('isIdentified / needsReview truth table', () => {
  // isIdentified = badge (green "identified"): true only when tagged
  // needsReview   = filter: true when neither tagged nor ignored
  const cases = [
    {
      tagged: true,
      ignored: false,
      expectedIdent: true,
      expectedReview: false,
    },
    {
      tagged: false,
      ignored: true,
      expectedIdent: false,
      expectedReview: false,
    }, // ignored ≠ identified
    { tagged: true, ignored: true, expectedIdent: true, expectedReview: false },
    {
      tagged: false,
      ignored: false,
      expectedIdent: false,
      expectedReview: true,
    },
  ];

  for (const { tagged, ignored, expectedIdent, expectedReview } of cases) {
    const label = `tagged=${tagged} ignored=${ignored}`;
    it(`isIdentified(${label}) = ${expectedIdent}`, () => {
      const album = mapAlbum({ tagged, ignored });
      expect(isIdentified(album)).toBe(expectedIdent);
    });
    it(`needsReview(${label}) = ${expectedReview}`, () => {
      const album = mapAlbum({ tagged, ignored });
      expect(needsReview(album)).toBe(expectedReview);
    });
  }

  it('ignored-but-untagged: not identified, not needing review', () => {
    const album = mapAlbum({ tagged: false, ignored: true });
    expect(isIdentified(album)).toBe(false);
    expect(needsReview(album)).toBe(false);
  });
});
