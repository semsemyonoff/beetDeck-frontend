/**
 * Pure helpers for the Cover Art Archive gallery.
 *
 * They operate on the `images[]` entries of `GET /api/album/<id>/artwork`
 * (`image_id`, `types[]`, `front`, `back`, `approved`, `comment`,
 * `thumb_sizes[]`, `mb_url`, `width`, `height`) and hold no React state, so the
 * page and the lightbox share one ordering, one chip list and one thumbnail
 * rule instead of three.
 *
 * `image_id` is an **opaque decimal string** everywhere. The backend pins it as
 * a string because CAA sends a JSON number while the `beetdeck_cover_image_id`
 * flex attr comes back as TEXT; anything here that re-reads it as a number
 * would make `current_image_id === image_id` false after a reload and silently
 * drop the *Current cover* marker.
 */

/**
 * The MusicBrainz cover art type vocabulary, in the order the gallery shows it.
 *
 * Front leads because it is the image someone came for; the rest run roughly
 * outside-in. Types CAA adds later are not in this list and are deliberately
 * not dropped — see `typeCounts` and `sortImages`.
 */
export const TYPE_ORDER = [
  'Front',
  'Back',
  'Booklet',
  'Medium',
  'Tray',
  'Obi',
  'Spine',
  'Track',
  'Liner',
  'Sticker',
  'Poster',
  'Watermark',
  'Matrix/Runout',
  'Top',
  'Bottom',
  'Raw/Unedited',
  'Other',
];

/** Long edge used when a slide's size is only known as a ratio. */
export const RATIO_LONG_EDGE = 1200;

const UNKNOWN_TYPE_RANK = TYPE_ORDER.length;

/** Rank of an image's primary type; unknown and untyped both sort last. */
function typeRank(image) {
  const primary = image?.types?.[0];
  const i = TYPE_ORDER.indexOf(primary);
  return i === -1 ? UNKNOWN_TYPE_RANK : i;
}

function isPositive(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Order the grid: by primary type, then by image id.
 *
 * CAA lists an image's types in its own order and the tile badge leads with
 * `types[0]`, so that is the one that decides where the tile lands. The id
 * tie-break is a **string** comparison by code unit — `"10"` before `"9"` — not
 * a numeric one: the id is opaque here, and a stable, locale-independent order
 * is worth more than a numerically pleasing one.
 *
 * Returns a new array; the caller's list is never mutated.
 */
export function sortImages(images) {
  return (images || []).slice().sort((a, b) => {
    const rank = typeRank(a) - typeRank(b);
    if (rank !== 0) return rank;
    const ida = String(a?.image_id ?? '');
    const idb = String(b?.image_id ?? '');
    if (ida < idb) return -1;
    if (ida > idb) return 1;
    return 0;
  });
}

/**
 * The filter chips: every type actually present, with how many images carry it.
 *
 * An image with two types counts once under each — the chips filter, they do
 * not partition. Known types come in `TYPE_ORDER`; a type CAA added after this
 * list was written follows in first-seen order rather than being dropped, which
 * would leave those images visible in the grid but unreachable by any chip.
 *
 * The `All` chip belongs to the page, not here — this is the list of real
 * types.
 */
export function typeCounts(images) {
  const counts = new Map();
  for (const image of images || []) {
    for (const type of image?.types || []) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  const known = TYPE_ORDER.filter((t) => counts.has(t));
  const unknown = [...counts.keys()].filter((t) => !TYPE_ORDER.includes(t));
  return [...known, ...unknown].map((type) => ({
    type,
    count: counts.get(type),
  }));
}

/** Images carrying `type`; `'All'` (and no filter at all) is the identity. */
export function filterByType(images, type) {
  const list = images || [];
  if (!type || type === 'All') return list;
  return list.filter((image) => (image?.types || []).includes(type));
}

/**
 * The `size` to request for a box `target` CSS pixels wide: the smallest
 * rendition that still covers it, the largest available when none does, and
 * `'full'` for an image CAA generated no thumbnail for.
 *
 * It takes a target rather than hardcoding 250 because both callers pick from
 * the same set at different sizes — the grid's fixed 190 px tile and the
 * lightbox stage. Going the other way and always asking for the largest is what
 * turns one gallery open into 40 originals crossing the proxy.
 *
 * An unusable `target` resolves to the smallest rendition: an under-sized
 * thumbnail is the cheap direction to be wrong in.
 */
export function pickThumbSize(image, target) {
  const sizes = (image?.thumb_sizes || [])
    .filter(isPositive)
    .sort((a, b) => a - b);
  if (!sizes.length) return 'full';
  const want = isPositive(target) ? target : 0;
  const covering = sizes.find((size) => size >= want);
  return covering === undefined ? sizes[sizes.length - 1] : covering;
}

/**
 * `width`/`height` for one PhotoSwipe slide, which requires them per slide and
 * cannot get them from CAA.
 *
 * The API reports the **original's** measured size only once that file has
 * actually been stored, so until someone opens fullscreen or applies an image
 * there is nothing to report. The fallback is the ratio of the thumbnail the
 * grid already loaded (`naturalWidth`/`naturalHeight`, so an `<img>` element can
 * be passed straight in), scaled to `RATIO_LONG_EDGE` — the numbers are wrong
 * in absolute terms but the ratio is right, which is all PhotoSwipe lays out
 * with. `null` when neither is available; the caller decides what an unknown
 * size means, and the metadata panel shows an em dash rather than these.
 */
export function slideDimensions(image, naturalSize) {
  if (isPositive(image?.width) && isPositive(image?.height)) {
    return { width: image.width, height: image.height };
  }
  const nw = naturalSize?.naturalWidth ?? naturalSize?.width;
  const nh = naturalSize?.naturalHeight ?? naturalSize?.height;
  if (!isPositive(nw) || !isPositive(nh)) return null;
  const short = Math.max(
    1,
    Math.round((RATIO_LONG_EDGE * Math.min(nw, nh)) / Math.max(nw, nh))
  );
  return nw >= nh
    ? { width: RATIO_LONG_EDGE, height: short }
    : { width: short, height: RATIO_LONG_EDGE };
}
