export function parse(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (!raw) return { name: 'library' };
  const [head, ...rest] = raw.split('/');
  if (head === 'artist' && rest.length > 0) {
    const raw = rest.join('/');
    let artist;
    try {
      artist = decodeURIComponent(raw);
    } catch {
      artist = raw;
    }
    return { name: 'artist', artist };
  }
  if (head === 'album' && rest.length > 0) {
    // Only the artwork gallery has a sub-route today; any other suffix keeps
    // rendering the album page rather than falling through to the library,
    // which would lose the id the URL still carries.
    if (rest[1] === 'artwork') return { name: 'artwork', id: rest[0] };
    return { name: 'album', id: rest[0] };
  }
  if (head === 'untagged') {
    if (rest.length > 0) {
      const rawDir = rest.join('/');
      let dir;
      try {
        dir = decodeURIComponent(rawDir);
      } catch {
        dir = rawDir;
      }
      return { name: 'untagged', dir };
    }
    return { name: 'untagged' };
  }
  if (head === 'scan') {
    return { name: 'scan' };
  }
  return { name: 'library' };
}

export function hrefFor(target) {
  if (!target || target.name === 'library') return '#/';
  if (target.name === 'artist')
    return '#/artist/' + encodeURIComponent(target.artist);
  if (target.name === 'album') return '#/album/' + target.id;
  if (target.name === 'artwork') return '#/album/' + target.id + '/artwork';
  if (target.name === 'untagged') {
    if (target.dir != null)
      return '#/untagged/' + encodeURIComponent(target.dir);
    return '#/untagged';
  }
  if (target.name === 'scan') return '#/scan';
  return '#/';
}

export function navigate(target) {
  if (!target || target.name === 'library') {
    window.location.hash = '';
    return;
  }
  window.location.hash = hrefFor(target);
}
