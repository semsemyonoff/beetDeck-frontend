import { useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import Segmented from '../ui/Segmented.jsx';
import { Cover, CoverStack } from '../ui/Cover.jsx';
import { navigate } from '../useHashRoute.js';

function mapApi(apiArtists) {
  return (apiArtists || []).map((a) => ({
    name: a.artist,
    albums: (a.albums || []).map((al) => ({
      id: al.id,
      title: al.album,
      year: al.year,
      has_cover: al.has_cover,
      tagged: al.tagged,
      ignored: al.ignored,
      identified: !!(al.tagged || al.ignored),
    })),
  }));
}

function totals(artists) {
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

function LibraryHeader({ stats, filter, setFilter, layout, setLayout, sort, setSort }) {
  return (
    <div className="lib-header">
      <div className="lib-header-row">
        <div>
          <h1 className="page-title">Library</h1>
          <div className="page-sub">
            <span>
              <strong>{stats.artists}</strong> artists
            </span>
            <span className="dot">·</span>
            <span>
              <strong>{stats.albums}</strong> albums
            </span>
            <span className="dot">·</span>
            <span className="ok">
              <Icon name="check" size={12} /> {stats.ident} identified
            </span>
            <span className="dot">·</span>
            <span className="warn">
              <Icon name="alert" size={12} /> {stats.notIdent} need review
            </span>
          </div>
        </div>

        <div className="lib-header-right">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', badge: stats.albums },
              { value: 'ident', label: 'Identified' },
              { value: 'noident', label: 'Needs review', badge: stats.notIdent },
            ]}
          />
        </div>
      </div>

      <div className="lib-header-row lib-header-row-bottom">
        <Segmented
          value={layout}
          onChange={setLayout}
          size="sm"
          options={[
            { value: 'index', label: 'Index', icon: <Icon name="list" size={12} /> },
            { value: 'wall', label: 'Wall', icon: <Icon name="grid" size={12} /> },
          ]}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate({ name: 'untagged' })}
          title="Loose files without an album-artist"
        >
          <Icon name="alert" size={12} /> Untagged files
        </button>

        <div className="lib-sort">
          <span className="muted small">Sort</span>
          <Segmented
            value={sort}
            onChange={setSort}
            size="sm"
            options={[
              { value: 'az', label: 'A–Z' },
              { value: 'recent', label: 'Recently added' },
              { value: 'size', label: 'Most albums' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function LibraryIndex({ artists, filter, onArtist, onAlbum }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const isExpanded = (name) => expanded.has(name) || filter === 'noident';

  const filteredArtists = useMemo(() => {
    if (filter === 'all') return artists;
    return artists.filter((a) => {
      if (filter === 'ident') return a.albums.some((al) => al.identified);
      if (filter === 'noident') return a.albums.some((al) => !al.identified);
      return true;
    });
  }, [artists, filter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const a of filteredArtists) {
      const ch = (a.name[0] || '#').toUpperCase();
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch).push(a);
    }
    return [...map.entries()];
  }, [filteredArtists]);

  return (
    <div className="lib-index">
      {groups.map(([letter, list]) => (
        <section key={letter} className="lib-group">
          <h3 className="lib-group-letter">{letter}</h3>
          <div className="lib-rows">
            {list.map((artist) => {
              const open = isExpanded(artist.name);
              const visibleAlbums = artist.albums.filter((al) => {
                if (filter === 'ident') return al.identified;
                if (filter === 'noident') return !al.identified;
                return true;
              });
              const identCount = artist.albums.filter((a) => a.identified).length;
              const totalAll = artist.albums.length;
              const totalShown =
                filter === 'noident'
                  ? visibleAlbums.length
                  : filter === 'ident'
                    ? visibleAlbums.length
                    : totalAll;
              return (
                <div
                  key={artist.name}
                  className={'lib-row' + (open ? ' lib-row-open' : '')}
                >
                  <button className="lib-row-head" onClick={() => toggle(artist.name)}>
                    <span className={'lib-chevron' + (open ? ' lib-chevron-open' : '')}>
                      <Icon name="chevron" size={12} />
                    </span>
                    <CoverStack albums={artist.albums} size={32} />
                    <span
                      className="lib-row-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArtist(artist);
                      }}
                    >
                      {artist.name}
                    </span>
                    <span className="lib-row-meta">
                      {identCount < totalAll ? (
                        <span className="warn small">
                          <Icon name="alert" size={10} /> {totalAll - identCount}
                        </span>
                      ) : null}
                      <span className="lib-row-count">{totalShown}</span>
                    </span>
                  </button>
                  {open ? (
                    <div className="lib-row-albums">
                      {visibleAlbums.map((al) => (
                        <button
                          key={al.id}
                          className="lib-album-chip"
                          onClick={() => onAlbum(artist, al)}
                        >
                          <Cover album={al} size={56} rounded={4} showTitle={false} />
                          <div className="lib-album-chip-info">
                            <div className="lib-album-chip-title">
                              {al.title}
                              {al.identified ? (
                                <span className="dot-ok">
                                  <Icon name="check" size={10} />
                                </span>
                              ) : (
                                <span className="dot-warn">
                                  <Icon name="alert" size={10} />
                                </span>
                              )}
                            </div>
                            <div className="lib-album-chip-meta">{al.year}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function LibraryWall({ artists, filter, onArtist, onAlbum }) {
  const items = useMemo(() => {
    const out = [];
    for (const a of artists) {
      for (const al of a.albums) {
        if (filter === 'ident' && !al.identified) continue;
        if (filter === 'noident' && al.identified) continue;
        out.push({ artist: a, album: al });
      }
    }
    return out;
  }, [artists, filter]);

  return (
    <div className="lib-wall">
      {items.map(({ artist, album }) => (
        <button
          key={album.id}
          className="wall-card"
          onClick={() => onAlbum(artist, album)}
        >
          <Cover album={album} size={170} rounded={6} showTitle={false} />
          <div className="wall-card-info">
            <div className="wall-card-title">{album.title}</div>
            <div className="wall-card-meta">
              <span
                className="wall-card-artist"
                onClick={(e) => {
                  e.stopPropagation();
                  onArtist(artist);
                }}
              >
                {artist.name}
              </span>
              <span className="wall-card-year">{album.year}</span>
            </div>
          </div>
          {!album.identified ? <span className="wall-card-badge">needs review</span> : null}
        </button>
      ))}
    </div>
  );
}

export default function Library() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('az');
  const [layout, setLayout] = useState('index');

  useEffect(() => {
    let aborted = false;
    fetch('/api/library')
      .then((r) => {
        if (r.status === 503) return { _notInitialized: true };
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => {
        if (!aborted) setData(d);
      })
      .catch((e) => {
        if (!aborted) setError(String(e));
      });
    return () => {
      aborted = true;
    };
  }, []);

  const artists = useMemo(() => {
    if (!data || data._notInitialized) return [];
    const mapped = mapApi(data);
    let list = [...mapped];
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
  }, [data, sort]);

  const stats = useMemo(() => totals(artists), [artists]);

  const onArtist = (artist) => navigate({ name: 'artist', artist: artist.name });
  const onAlbum = (_artist, album) => navigate({ name: 'album', id: album.id });

  if (error) {
    return <div className="page page-library"><div className="error">Failed to load: {error}</div></div>;
  }
  if (!data) {
    return <div className="page page-library"><div className="muted">Loading…</div></div>;
  }
  if (data._notInitialized) {
    return (
      <div className="page page-library">
        <div className="empty-state">
          <h2>Library not initialized</h2>
          <p className="muted">The beets database has not been created yet. Run a full scan to import your music library.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-library">
      <LibraryHeader
        stats={stats}
        filter={filter}
        setFilter={setFilter}
        layout={layout}
        setLayout={setLayout}
        sort={sort}
        setSort={setSort}
      />
      <div className="lib-body">
        {layout === 'index' && (
          <LibraryIndex artists={artists} filter={filter} onArtist={onArtist} onAlbum={onAlbum} />
        )}
        {layout === 'wall' && (
          <LibraryWall artists={artists} filter={filter} onArtist={onArtist} onAlbum={onAlbum} />
        )}
      </div>
    </div>
  );
}
