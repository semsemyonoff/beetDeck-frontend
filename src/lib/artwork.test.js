import { describe, expect, it } from 'vitest';

import {
  RATIO_LONG_EDGE,
  TYPE_ORDER,
  filterByType,
  formatFetchedAt,
  mbCoverArtUrl,
  pickStageSize,
  pickThumbSize,
  provenanceLine,
  slideDimensions,
  typeCounts,
} from './artwork';

/** A listing entry with the fields the helpers actually read. */
function image(overrides = {}) {
  return {
    image_id: '1',
    types: ['Front'],
    front: true,
    back: false,
    approved: true,
    comment: '',
    thumb_sizes: [250, 500, 1200],
    mb_url: 'https://musicbrainz.org/release/mbid',
    width: null,
    height: null,
    ...overrides,
  };
}

const ids = (images) => images.map((i) => i.image_id);

describe('TYPE_ORDER', () => {
  it('leads with Front', () => {
    expect(TYPE_ORDER[0]).toBe('Front');
  });

  it('has no duplicates', () => {
    expect(new Set(TYPE_ORDER).size).toBe(TYPE_ORDER.length);
  });
});

describe('mbCoverArtUrl', () => {
  it('points at the release cover art page, not the release page', () => {
    // Where these scans are uploaded, reordered and edited — the release page
    // shows the tracklist, which is not what this gallery is about.
    expect(mbCoverArtUrl('abc-123')).toBe(
      'https://musicbrainz.org/release/abc-123/cover-art'
    );
  });

  it.each([
    ['an empty id', ''],
    ['null', null],
    ['undefined', undefined],
  ])('returns null for %s rather than a link to nothing', (_label, mbid) => {
    expect(mbCoverArtUrl(mbid)).toBeNull();
  });
});

describe('typeCounts', () => {
  it('counts the types actually present, in TYPE_ORDER', () => {
    const images = [
      image({ image_id: '1', types: ['Medium'] }),
      image({ image_id: '2', types: ['Front'] }),
      image({ image_id: '3', types: ['Medium'] }),
    ];
    expect(typeCounts(images)).toEqual([
      { type: 'Front', count: 1 },
      { type: 'Medium', count: 2 },
    ]);
  });

  it('counts a two-typed image under each of its types', () => {
    // The chips filter, they do not partition — the counts sum past the list length.
    const images = [image({ image_id: '1', types: ['Front', 'Booklet'] })];
    expect(typeCounts(images)).toEqual([
      { type: 'Front', count: 1 },
      { type: 'Booklet', count: 1 },
    ]);
  });

  it('keeps a type CAA added after TYPE_ORDER was written, after the known ones', () => {
    const images = [
      image({ image_id: '1', types: ['Fanart'] }),
      image({ image_id: '2', types: ['Back'] }),
    ];
    expect(typeCounts(images)).toEqual([
      { type: 'Back', count: 1 },
      { type: 'Fanart', count: 1 },
    ]);
  });

  it('omits the All chip — that one belongs to the page', () => {
    const counts = typeCounts([image()]);
    expect(counts.map((c) => c.type)).not.toContain('All');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty list', []],
    ['untyped images', [image({ types: [] })]],
  ])('returns no chips for %s', (_label, input) => {
    expect(typeCounts(input)).toEqual([]);
  });
});

describe('filterByType', () => {
  const images = [
    image({ image_id: '1', types: ['Front'] }),
    image({ image_id: '2', types: ['Booklet', 'Front'] }),
    image({ image_id: '3', types: ['Back'] }),
  ];

  it('keeps every image carrying the type, primary or not', () => {
    expect(ids(filterByType(images, 'Front'))).toEqual(['1', '2']);
  });

  it.each([
    ['All', 'All'],
    ['an empty filter', ''],
    ['no filter at all', undefined],
  ])('treats %s as the identity', (_label, type) => {
    expect(filterByType(images, type)).toBe(images);
  });

  it('returns nothing for a type no image carries', () => {
    expect(filterByType(images, 'Obi')).toEqual([]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('tolerates %s as the list', (_label, input) => {
    expect(filterByType(input, 'Front')).toEqual([]);
  });
});

describe('pickThumbSize', () => {
  it.each([
    [
      'the exact rendition when one matches the box',
      [250, 500, 1200],
      250,
      250,
    ],
    ['the smallest rendition covering the box', [250, 500, 1200], 190, 250],
    ['the next size up for a box past a rendition', [250, 500, 1200], 260, 500],
    ['the largest available when none covers', [250, 500], 2000, 500],
  ])('picks %s', (_label, thumb_sizes, target, expected) => {
    expect(pickThumbSize(image({ thumb_sizes }), target)).toBe(expected);
  });

  it('picks 500 for a 400 px box on an image CAA never rendered at 1200', () => {
    // Older uploads have no 1200; asking for it would 400 at the binary route.
    expect(pickThumbSize(image({ thumb_sizes: [250, 500] }), 400)).toBe(500);
  });

  it('falls back to full for an image with no thumbnails at all', () => {
    expect(pickThumbSize(image({ thumb_sizes: [] }), 190)).toBe('full');
  });

  it.each([
    ['a missing thumb_sizes field', undefined],
    ['a null thumb_sizes', null],
  ])('falls back to full for %s', (_label, thumb_sizes) => {
    const img = image({ thumb_sizes });
    if (thumb_sizes === undefined) delete img.thumb_sizes;
    expect(pickThumbSize(img, 190)).toBe('full');
  });

  it('falls back to full for a missing image', () => {
    expect(pickThumbSize(null, 190)).toBe('full');
  });

  it('sorts the renditions before choosing', () => {
    expect(pickThumbSize(image({ thumb_sizes: [1200, 250, 500] }), 190)).toBe(
      250
    );
  });

  it.each([
    ['zero', 0],
    ['a negative box', -10],
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('resolves %s to the smallest rendition', (_label, target) => {
    // Under-sized is the cheap direction to be wrong in — 40 originals is not.
    expect(pickThumbSize(image(), target)).toBe(250);
  });
});

describe('pickStageSize', () => {
  it('takes the smallest rendition that covers the stage', () => {
    expect(pickStageSize(image({ thumb_sizes: [250, 500, 1200] }), 900)).toBe(
      1200
    );
  });

  it('takes the original when no rendition covers the stage', () => {
    // Where it parts ways with the grid rule: CAA generates no 1200 for older
    // uploads, and 500 blown up to a 900 px stage is the blur this fixes.
    expect(pickStageSize(image({ thumb_sizes: [250, 500] }), 900)).toBe('full');
  });

  it('still takes a thumbnail on a stage small enough for one', () => {
    expect(pickStageSize(image({ thumb_sizes: [250, 500] }), 400)).toBe(500);
    expect(pickStageSize(image({ thumb_sizes: [250, 500] }), 500)).toBe(500);
  });

  it('takes the original when CAA generated no thumbnails', () => {
    expect(pickStageSize(image({ thumb_sizes: [] }), 400)).toBe('full');
  });

  it.each([
    ['zero', 0],
    ['a negative stage', -10],
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('resolves %s to the original, unlike the grid rule', (_label, target) => {
    // On this screen quality is the cheap direction to be wrong in.
    expect(pickStageSize(image(), target)).toBe('full');
  });
});

describe('slideDimensions', () => {
  it('uses the measured original when the API has it', () => {
    expect(slideDimensions(image({ width: 1425, height: 1400 }), null)).toEqual(
      {
        width: 1425,
        height: 1400,
      }
    );
  });

  it('prefers the measurement over a loaded thumbnail', () => {
    const measured = image({ width: 1425, height: 1425 });
    expect(
      slideDimensions(measured, { naturalWidth: 250, naturalHeight: 250 })
    ).toEqual({ width: 1425, height: 1425 });
  });

  it('derives a landscape ratio from the loaded thumbnail', () => {
    // A 2:1 booklet spread, unmeasured: absolute numbers are wrong, the ratio is right.
    expect(
      slideDimensions(image(), { naturalWidth: 500, naturalHeight: 250 })
    ).toEqual({ width: RATIO_LONG_EDGE, height: RATIO_LONG_EDGE / 2 });
  });

  it('derives a portrait ratio from the loaded thumbnail', () => {
    // A ~1:8 spine.
    expect(
      slideDimensions(image(), { naturalWidth: 32, naturalHeight: 256 })
    ).toEqual({ width: RATIO_LONG_EDGE / 8, height: RATIO_LONG_EDGE });
  });

  it('accepts a plain width/height pair as the natural size', () => {
    expect(slideDimensions(image(), { width: 250, height: 250 })).toEqual({
      width: RATIO_LONG_EDGE,
      height: RATIO_LONG_EDGE,
    });
  });

  it('never rounds a short edge down to zero', () => {
    const dims = slideDimensions(image(), {
      naturalWidth: 4000,
      naturalHeight: 1,
    });
    expect(dims.height).toBeGreaterThan(0);
  });

  it.each([
    ['no natural size', null],
    ['an unloaded img element', { naturalWidth: 0, naturalHeight: 0 }],
    ['a partial natural size', { naturalWidth: 250 }],
  ])('returns null for an unmeasured image with %s', (_label, natural) => {
    expect(slideDimensions(image(), natural)).toBeNull();
  });

  it.each([
    ['a zero dimension', { width: 0, height: 0 }],
    ['only a width', { width: 1425, height: null }],
  ])('ignores %s on the API record', (_label, overrides) => {
    expect(
      slideDimensions(image(overrides), {
        naturalWidth: 250,
        naturalHeight: 250,
      })
    ).toEqual({ width: RATIO_LONG_EDGE, height: RATIO_LONG_EDGE });
  });

  it('returns null for a missing image with nothing loaded', () => {
    expect(slideDimensions(null, null)).toBeNull();
  });
});

describe('formatFetchedAt', () => {
  const CASES = [
    ['2026-08-14T12:00:00Z', '2026-08-14 12:00 UTC'],
    ['2026-08-14T12:34:56.789012Z', '2026-08-14 12:34 UTC'],
    ['2026-08-14T12:34:56+00:00', '2026-08-14 12:34 UTC'],
    // Anything that is not an ISO timestamp is shown as-is rather than dropped:
    // a value the API grew is still a fact about the listing.
    ['yesterday', 'yesterday'],
  ];

  it.each(CASES)('formats %s', (iso, expected) => {
    expect(formatFetchedAt(iso)).toBe(expected);
  });

  it.each([null, undefined, ''])('returns null for %p', (iso) => {
    expect(formatFetchedAt(iso)).toBeNull();
  });
});

describe('provenanceLine', () => {
  const CASES = [
    [
      { source: 'storage', fetched_at: '2026-08-14T12:00:00Z' },
      'from local storage · fetched 2026-08-14 12:00 UTC',
    ],
    [
      { source: 'cache', fetched_at: '2026-08-14T12:00:00Z' },
      'from cache · fetched 2026-08-14 12:00 UTC',
    ],
    // A remote listing *is* the fetch, so it carries no timestamp.
    [
      { source: 'remote', fetched_at: null },
      'from Cover Art Archive · just fetched',
    ],
    // An unknown source is rendered rather than blanked — the closed set grew.
    [{ source: 'mirror', fetched_at: null }, 'from mirror · just fetched'],
  ];

  it.each(CASES)('renders %o', (listing, expected) => {
    expect(provenanceLine(listing)).toBe(expected);
  });

  it.each([null, { source: null }, { source: '' }])(
    'returns null without a source (%p)',
    (listing) => {
      expect(provenanceLine(listing)).toBeNull();
    }
  );
});
