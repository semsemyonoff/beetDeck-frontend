import { mapAlbum } from './albums.js';

export function mapApi(apiArtists) {
  return (apiArtists || []).map((a) => ({
    name: a.artist,
    albums: (a.albums || []).map(mapAlbum),
  }));
}

export function totals(artists) {
  let albums = 0;
  let ident = 0;
  let notIdent = 0;
  for (const a of artists) {
    for (const al of a.albums) {
      albums++;
      if (al.identified) ident++;
      else notIdent++;
    }
  }
  return { artists: artists.length, albums, ident, notIdent };
}

export function sortArtists(artists, sort) {
  const list = [...artists];
  if (sort === 'az') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'size') {
    list.sort((a, b) => b.albums.length - a.albums.length);
  } else if (sort === 'recent') {
    list.sort((a, b) => {
      const yA = Math.max(0, ...a.albums.map((x) => x.year || 0));
      const yB = Math.max(0, ...b.albums.map((x) => x.year || 0));
      return yB - yA;
    });
  }
  return list;
}

export function filterArtists(artists, filter) {
  if (filter === 'all') return artists;
  return artists.filter((a) => {
    if (filter === 'ident') return a.albums.some((al) => al.identified);
    if (filter === 'noident') return a.albums.some((al) => !al.identified);
    return true;
  });
}

export function filterAlbums(albums, filter) {
  if (filter === 'ident') return albums.filter((al) => al.identified);
  if (filter === 'noident') return albums.filter((al) => !al.identified);
  return albums;
}

export function letterGroups(artists) {
  const map = new Map();
  for (const a of artists) {
    const ch = (a.name[0] || '#').toUpperCase();
    if (!map.has(ch)) map.set(ch, []);
    map.get(ch).push(a);
  }
  return [...map.entries()];
}
