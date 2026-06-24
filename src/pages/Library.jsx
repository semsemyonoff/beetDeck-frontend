import { useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import Segmented from '../ui/Segmented.jsx';
import { Cover, CoverStack } from '../ui/Cover.jsx';
import UntaggedGroup from '../ui/UntaggedGroup.jsx';
import RouteLink from '../ui/RouteLink.jsx';
import {
  mapApi,
  totals,
  sortArtists,
  filterArtists,
  filterAlbums,
  letterGroups,
} from '../lib/library.js';
import { isIdentified } from '../lib/albums.js';
import { groupUntagged, excludeUntagged } from '../lib/tagEditor.js';

function LibraryHeader({
  stats,
  filter,
  setFilter,
  layout,
  setLayout,
  sort,
  setSort,
}) {
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
              {
                value: 'noident',
                label: 'Needs review',
                badge: stats.notIdent,
              },
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
            {
              value: 'index',
              label: 'Index',
              icon: <Icon name="list" size={12} />,
            },
            {
              value: 'wall',
              label: 'Wall',
              icon: <Icon name="grid" size={12} />,
            },
          ]}
        />

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

function LibraryIndex({ artists, filter, folders }) {
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

  const filteredArtists = useMemo(
    () => filterArtists(artists, filter),
    [artists, filter]
  );

  const groups = useMemo(
    () => letterGroups(filteredArtists),
    [filteredArtists]
  );

  return (
    <div className="lib-index">
      {filter !== 'ident' ? <UntaggedGroup folders={folders} /> : null}
      {groups.map(([letter, list]) => (
        <section key={letter} className="lib-group">
          <h3 className="lib-group-letter">{letter}</h3>
          <div className="lib-rows">
            {list.map((artist) => {
              const open = isExpanded(artist.name);
              const visibleAlbums = filterAlbums(artist.albums, filter);
              const identCount = artist.albums.filter(
                (a) => a.identified
              ).length;
              const totalAll = artist.albums.length;
              const totalShown =
                filter === 'all' ? totalAll : visibleAlbums.length;
              const albumsId = `row-albums-${artist.name.replace(/[^\w-]/g, '_')}`;
              return (
                <div
                  key={artist.name}
                  className={'lib-row' + (open ? ' lib-row-open' : '')}
                >
                  <div className="lib-row-head">
                    <button
                      className="lib-row-toggle"
                      onClick={() => toggle(artist.name)}
                      aria-label={`Toggle albums for ${artist.name}`}
                      aria-expanded={open}
                      aria-controls={albumsId}
                    >
                      <span
                        className={
                          'lib-chevron' + (open ? ' lib-chevron-open' : '')
                        }
                      >
                        <Icon name="chevron" size={12} />
                      </span>
                      <CoverStack albums={artist.albums} size={32} />
                    </button>
                    <RouteLink
                      className="lib-row-name"
                      target={{ name: 'artist', artist: artist.name }}
                    >
                      {artist.name}
                    </RouteLink>
                    <span className="lib-row-meta">
                      {identCount < totalAll ? (
                        <span className="warn small">
                          <Icon name="alert" size={10} />{' '}
                          {totalAll - identCount}
                        </span>
                      ) : null}
                      <span className="lib-row-count">{totalShown}</span>
                    </span>
                  </div>
                  {open ? (
                    <div className="lib-row-albums" id={albumsId}>
                      {visibleAlbums.map((al) => (
                        <RouteLink
                          key={al.id}
                          className="lib-album-chip"
                          target={{ name: 'album', id: al.id }}
                        >
                          <Cover
                            album={al}
                            size={56}
                            rounded={4}
                            showTitle={false}
                          />
                          <div className="lib-album-chip-info">
                            <div className="lib-album-chip-title">
                              {al.title}
                              {isIdentified(al) ? (
                                <span className="dot-ok">
                                  <Icon name="check" size={11} />
                                </span>
                              ) : al.ignored ? (
                                <span className="dot-ignored">
                                  <Icon name="check" size={11} />
                                </span>
                              ) : !al.identified ? (
                                <span className="dot-warn">
                                  <Icon name="alert" size={11} />
                                </span>
                              ) : null}
                            </div>
                            <div className="lib-album-chip-meta">{al.year}</div>
                          </div>
                        </RouteLink>
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

function LibraryWall({ artists, filter, folders }) {
  const items = useMemo(() => {
    const out = [];
    for (const a of artists) {
      for (const al of filterAlbums(a.albums, filter)) {
        out.push({ artist: a, album: al });
      }
    }
    return out;
  }, [artists, filter]);

  return (
    <div className="lib-wall-wrap">
      {filter !== 'ident' ? <UntaggedGroup folders={folders} wall /> : null}
      <div className="lib-wall">
        {items.map(({ artist, album }) => (
          <div key={album.id} className="wall-card">
            <RouteLink
              className="wall-card-link"
              target={{ name: 'album', id: album.id }}
            >
              <Cover album={album} size={170} rounded={6} showTitle={false} />
              <div className="wall-card-info">
                <div className="wall-card-title">{album.title}</div>
              </div>
            </RouteLink>
            <div className="wall-card-meta">
              <RouteLink
                className="wall-card-artist"
                target={{ name: 'artist', artist: artist.name }}
              >
                {artist.name}
              </RouteLink>
              <span className="wall-card-year">{album.year}</span>
            </div>
            {isIdentified(album) ? (
              <span className="wall-card-check wall-card-check-ok">
                <Icon name="check" size={12} />
              </span>
            ) : album.ignored ? (
              <span className="wall-card-check wall-card-check-ignored">
                <Icon name="check" size={12} />
              </span>
            ) : (
              <span className="wall-card-badge">needs review</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Library({ dataVersion = 0 }) {
  const [data, setData] = useState(null);
  const [untaggedItems, setUntaggedItems] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('az');
  const [layout, setLayout] = useState('index');

  useEffect(() => {
    let aborted = false;
    Promise.all([
      fetch('/api/library').then((r) => {
        if (r.status === 503) return { _notInitialized: true };
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
      fetch('/api/items/untagged')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([lib, untagged]) => {
        if (!aborted) {
          setData(lib);
          setUntaggedItems(untagged);
        }
      })
      .catch((e) => {
        if (!aborted) setError(String(e));
      });
    return () => {
      aborted = true;
    };
  }, [dataVersion]);

  const folders = useMemo(() => groupUntagged(untaggedItems), [untaggedItems]);

  const artists = useMemo(() => {
    if (!data || data._notInitialized) return [];
    const sorted = sortArtists(mapApi(data), sort);
    const ids = (untaggedItems || [])
      .map((item) => item.album_id)
      .filter(Boolean);
    return excludeUntagged(sorted, ids);
  }, [data, sort, untaggedItems]);

  const stats = useMemo(() => totals(artists), [artists]);

  if (error) {
    return (
      <div className="page page-library">
        <div className="error">Failed to load: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page page-library">
        <div className="muted">Loading…</div>
      </div>
    );
  }
  if (data._notInitialized) {
    return (
      <div className="page page-library">
        <div className="empty-state">
          <h2>Library not initialized</h2>
          <p className="muted">
            The beets database has not been created yet. Run a full scan to
            import your music library.
          </p>
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
          <LibraryIndex artists={artists} filter={filter} folders={folders} />
        )}
        {layout === 'wall' && (
          <LibraryWall artists={artists} filter={filter} folders={folders} />
        )}
      </div>
    </div>
  );
}
