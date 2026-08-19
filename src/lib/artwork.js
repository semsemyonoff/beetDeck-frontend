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
 * The MusicBrainz cover art type vocabulary, in the order the **chips** show it.
 *
 * Front leads because it is the image someone came for; the rest run roughly
 * outside-in. Types CAA adds later are not in this list and are deliberately
 * not dropped — see `typeCounts`.
 *
 * It orders the chips and nothing else. The **grid** renders the listing in the
 * order the API returned, which is CAA's own — see the note in `pages/Artwork.jsx`.
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

/**
 * The grid tile's guaranteed minimum width, matching the CSS
 * `repeat(auto-fill, minmax(190px, 1fr))`.
 *
 * It lives here rather than in the page because the lightbox needs the *same*
 * number: PhotoSwipe's placeholder is only instant if it names the rendition the
 * grid actually loaded, and `pickThumbSize` is what decides that. Hardcoding a
 * size on either side desynchronises them for any image whose `thumb_sizes` do
 * not happen to include it — the placeholder then misses the browser cache and
 * asks the proxy for a rendition the backend answers `400` for.
 */
export const TILE_PX = 190;

function isPositive(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * The release's cover art page on MusicBrainz — where these scans are edited,
 * reordered and uploaded.
 *
 * The `/cover-art` tab, not the bare release page: this gallery's subject is the
 * artwork, and the release page shows the tracklist. `mb_url` on an image points
 * at the release itself and is left alone; CAA has no per-image page for it to
 * point at anyway.
 */
export function mbCoverArtUrl(mbid) {
  return mbid ? `https://musicbrainz.org/release/${mbid}/cover-art` : null;
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
 * The `size` for the lightbox stage: the smallest rendition that actually
 * **covers** `target`, and the original when none does.
 *
 * The fallback is the whole difference from `pickThumbSize`, and it is the
 * point. A 190 px tile is well served by the largest thumbnail CAA happened to
 * generate; the stage is the screen where someone judges a scan, and CAA
 * generates no `1200` for older uploads — those releases fall back to `500`,
 * which is visibly soft blown up to ~900 CSS px (worse again on a 2× display,
 * which is why the caller measures its target in device pixels). There the
 * original is the only honest answer, and the grid thumbnail already on screen
 * covers the wait.
 *
 * An unusable `target` resolves to the original for the same reason — on this
 * screen quality is the cheap direction to be wrong in, the opposite of the
 * grid's.
 */
export function pickStageSize(image, target) {
  const size = pickThumbSize(image, target);
  if (size === 'full' || !isPositive(target)) return 'full';
  return size >= target ? size : 'full';
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

/**
 * Where the listing on screen came from. `source` is a closed set on the
 * backend, so an unknown value means the API grew one and the page says so
 * rather than rendering an empty gap.
 */
const SOURCE_LABEL = {
  storage: 'local storage',
  cache: 'cache',
  remote: 'Cover Art Archive',
};

/**
 * The API timestamp is ISO-8601 UTC. Rendered date+minute, not through
 * `toLocaleString`: the provenance line is an operational fact ("this listing
 * is from yesterday"), and a locale-dependent string makes it untestable for
 * the sake of an hour of precision nobody reads here. A value that is not an
 * ISO timestamp is passed through rather than dropped.
 */
export function formatFetchedAt(iso) {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(iso));
  return m ? `${m[1]} ${m[2]} UTC` : String(iso);
}

/** The page-header line built from a listing's `source` + `fetched_at`. */
export function provenanceLine(listing) {
  if (!listing) return null;
  const label = SOURCE_LABEL[listing.source] || listing.source;
  if (!label) return null;
  const at = formatFetchedAt(listing.fetched_at);
  // A remote listing has no `fetched_at` — it *is* the fetch.
  return at ? `from ${label} · fetched ${at}` : `from ${label} · just fetched`;
}
