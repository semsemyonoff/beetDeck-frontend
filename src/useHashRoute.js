import { useEffect, useState } from 'react';

function parse(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (!raw) return { name: 'library' };
  const [head, ...rest] = raw.split('/');
  if (head === 'artist' && rest.length > 0) {
    return { name: 'artist', artist: decodeURIComponent(rest.join('/')) };
  }
  if (head === 'album' && rest.length > 0) {
    return { name: 'album', id: rest[0] };
  }
  if (head === 'untagged') return { name: 'untagged' };
  return { name: 'library' };
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(target) {
  if (!target || target.name === 'library') {
    window.location.hash = '';
  } else if (target.name === 'artist') {
    window.location.hash = '#/artist/' + encodeURIComponent(target.artist);
  } else if (target.name === 'album') {
    window.location.hash = '#/album/' + target.id;
  } else if (target.name === 'untagged') {
    window.location.hash = '#/untagged';
  }
}
