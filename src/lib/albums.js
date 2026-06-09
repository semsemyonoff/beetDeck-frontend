export function mapAlbum(al) {
  return {
    id: al.id,
    title: al.album,
    year: al.year,
    has_cover: al.has_cover,
    tagged: al.tagged,
    ignored: al.ignored,
    identified: !!(al.tagged || al.ignored),
  };
}

// Note: Task 5 will update isIdentified to only return true when tagged === true.
// For now it mirrors the `identified` field set by mapAlbum (tagged || ignored).
export function isIdentified(album) {
  return !!album.identified;
}

// needsReview: true when the album has not been tagged or ignored.
// Ignored albums don't need review even though they're not tagged.
export function needsReview(album) {
  return !album.identified;
}
