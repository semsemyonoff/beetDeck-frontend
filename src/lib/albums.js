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

// Badge: green "identified" only when explicitly tagged.
// An ignored-but-untagged album is not "identified" for badge purposes.
export function isIdentified(album) {
  return !!album.tagged;
}

// needsReview: true when the album has not been tagged or ignored.
// Ignored albums don't need review even though they're not tagged.
export function needsReview(album) {
  return !album.identified;
}
