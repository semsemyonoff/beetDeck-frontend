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
  return { name: 'library' };
}

export function hrefFor(target) {
  if (!target || target.name === 'library') return '#/';
  if (target.name === 'artist')
    return '#/artist/' + encodeURIComponent(target.artist);
  if (target.name === 'album') return '#/album/' + target.id;
  if (target.name === 'untagged') {
    if (target.dir != null)
      return '#/untagged/' + encodeURIComponent(target.dir);
    return '#/untagged';
  }
  return '#/';
}

export function navigate(target) {
  if (!target || target.name === 'library') {
    window.location.hash = '';
    return;
  }
  window.location.hash = hrefFor(target);
}
