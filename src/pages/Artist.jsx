import { useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import Segmented from '../ui/Segmented.jsx';
import { Cover } from '../ui/Cover.jsx';
import { navigate } from '../useHashRoute.js';

function mapAlbums(apiAlbums) {
  return (apiAlbums || []).map((al) => ({
    id: al.id,
    title: al.album,
    year: al.year,
    has_cover: al.has_cover,
    tagged: al.tagged,
    ignored: al.ignored,
    identified: !!(al.tagged || al.ignored),
  }));
}

export default function Artist({ name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let aborted = false;
    setData(null);
    setError(null);
    fetch('/api/artist?name=' + encodeURIComponent(name))
      .then((r) => {
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
  }, [name]);

  const albums = useMemo(() => (data ? mapAlbums(data.albums) : []), [data]);
  const total = albums.length;
  const ident = albums.filter((a) => a.identified).length;
  const years = albums.map((a) => a.year).filter(Boolean);
  const range = years.length ? `${Math.min(...years)} – ${Math.max(...years)}` : '—';

  const visible = useMemo(() => {
    let list = albums;
    if (filter === 'ident') list = list.filter((a) => a.identified);
    if (filter === 'noident') list = list.filter((a) => !a.identified);
    return [...list].sort((a, b) => (a.year || 0) - (b.year || 0));
  }, [albums, filter]);

  if (error) {
    return (
      <div className="page page-artist">
        <div className="error">Failed to load: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page page-artist">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page page-artist">
      <div className="crumbs">
        <button className="crumb" onClick={() => navigate({ name: 'library' })}>
          <Icon name="arrow-left" size={12} /> Library
        </button>
      </div>

      <header className="artist-hero">
        <div className="artist-hero-covers">
          {albums.slice(0, 4).map((a, i) => (
            <div
              key={a.id}
              className="artist-hero-cover"
              style={{
                transform: `translate(${i * 8}px, ${i * 4}px) rotate(${(i - 1) * 2}deg)`,
                zIndex: 10 - i,
              }}
            >
              <Cover album={a} size={150} rounded={6} showTitle={false} />
            </div>
          ))}
        </div>
        <div className="artist-hero-text">
          <div className="artist-hero-eyebrow">Artist</div>
          <h1 className="artist-hero-name">{name}</h1>
          <div className="artist-hero-stats">
            <span>
              <strong>{total}</strong> albums
            </span>
            <span className="dot">·</span>
            <span>{range}</span>
            <span className="dot">·</span>
            {ident < total ? (
              <span className="warn">
                <Icon name="alert" size={12} /> {total - ident} need review
              </span>
            ) : (
              <span className="ok">
                <Icon name="check" size={12} /> all identified
              </span>
            )}
          </div>
          <p className="artist-hero-hint muted small">
            Album-level actions live on each album. Open one to identify, edit tags, or fetch lyrics.
          </p>
        </div>
      </header>

      <div className="artist-toolbar">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', badge: total },
            { value: 'ident', label: 'Identified', badge: ident },
            { value: 'noident', label: 'Needs review', badge: total - ident },
          ]}
        />
        <span className="muted small">Sorted by release year</span>
      </div>

      <div className="artist-grid">
        {visible.map((al) => (
          <button
            key={al.id}
            className="album-card"
            onClick={() => navigate({ name: 'album', id: al.id })}
          >
            <Cover album={al} size={220} rounded={6} showTitle={false} />
            <div className="album-card-info">
              <div className="album-card-title">{al.title}</div>
              <div className="album-card-meta">
                <span>{al.year}</span>
                {al.identified ? (
                  <span className="ok small">
                    <Icon name="check" size={10} />
                  </span>
                ) : (
                  <span className="warn small">
                    <Icon name="alert" size={10} /> review
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
