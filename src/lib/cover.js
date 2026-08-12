/**
 * Cover-art size helpers.
 *
 * The fetch endpoint answers with both the candidate's pixel size and the size
 * of the cover already on the album, so "is this an upgrade" is a local
 * comparison rather than something the user has to eyeball. Kept pure so the
 * modal stays markup.
 */

/** `"1200×1200"`, or `null` when either dimension is missing. */
export function formatDimensions(width, height) {
  if (!width || !height) return null;
  return `${width}×${height}`;
}

/**
 * How the candidate compares with the cover in place.
 *
 * Compared by pixel area, not by width: a 1000×1000 candidate beats a
 * 1200×600 cover despite being narrower, and area is what "bigger picture"
 * means to someone looking at it.
 *
 * `hasCurrent` is what separates the two ways a size can be missing. The
 * backend sends `current_width: null` both for an album with no cover and for
 * one whose cover it could not measure, and calling the second "no cover yet"
 * invites replacing a perfectly good image with a smaller one. Pass the
 * album's own `has_cover` flag: without a cover the verdict is `'new'`, with
 * one but no measurement it is `'unknown'`.
 */
export function compareCoverSize(
  current,
  candidate,
  { hasCurrent = false } = {}
) {
  if (!candidate?.width || !candidate?.height) return null;
  if (!current?.width || !current?.height)
    return hasCurrent ? 'unknown' : 'new';
  const currentArea = current.width * current.height;
  const candidateArea = candidate.width * candidate.height;
  if (candidateArea > currentArea) return 'larger';
  if (candidateArea < currentArea) return 'smaller';
  return 'same';
}
