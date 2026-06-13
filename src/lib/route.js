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

export function navigate(target) {
  if (!target || target.name === 'library') {
    window.location.hash = '';
  } else if (target.name === 'artist') {
    window.location.hash = '#/artist/' + encodeURIComponent(target.artist);
  } else if (target.name === 'album') {
    window.location.hash = '#/album/' + target.id;
  } else if (target.name === 'untagged') {
    if (target.dir != null) {
      window.location.hash = '#/untagged/' + encodeURIComponent(target.dir);
    } else {
      window.location.hash = '#/untagged';
    }
  }
}
