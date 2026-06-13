import { useEffect, useRef, useState } from 'react';
import Topbar from './ui/Topbar.jsx';
import Library from './pages/Library.jsx';
import Artist from './pages/Artist.jsx';
import Album from './pages/Album.jsx';
import Untagged from './pages/Untagged.jsx';
import { useHashRoute, navigate } from './useHashRoute.js';
import { buildScanSummary } from './lib/scan.js';

export default function App() {
  const route = useHashRoute();
  const [search, setSearch] = useState({ q: '', results: null });
  const [scanStatus, setScanStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [scanSummary, setScanSummary] = useState(null); // { added, removed } | null
  const scanPollRef = useRef(null);

  const handleSearch = ({ q, results }) => {
    setSearch({ q, results: q ? results : null });
  };

  const startScanPolling = () => {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    scanPollRef.current = setInterval(async () => {
      try {
        const resp = await fetch('/api/rescan/status');
        if (!resp.ok) return;
        const d = await resp.json();
        if (d.status === 'done' || d.status === 'idle') {
          clearInterval(scanPollRef.current);
          if (d.returncode !== undefined && d.returncode !== 0) {
            setScanStatus('error');
            setScanSummary(null);
          } else {
            setScanStatus('done');
            setScanSummary(buildScanSummary(d));
          }
          setTimeout(() => {
            setScanStatus(null);
            setScanSummary(null);
          }, 3000);
        }
      } catch {
        clearInterval(scanPollRef.current);
        setScanStatus('error');
        setTimeout(() => setScanStatus(null), 3000);
      }
    }, 1500);
  };

  const handleScanStart = ({ ok, data }) => {
    if (!ok) {
      if (data?.status === 'running') {
        setScanStatus('running');
        startScanPolling();
      } else {
        setScanStatus('error');
        setTimeout(() => setScanStatus(null), 3000);
      }
      return;
    }
    setScanStatus('running');
    startScanPolling();
  };

  useEffect(() => () => clearInterval(scanPollRef.current), []);

  const closeSearch = () => setSearch({ q: '', results: null });

  const searchResults = search.results;

  return (
    <div className="app">
      <Topbar
        onNavHome={() => {
          closeSearch();
          navigate({ name: 'library' });
        }}
        onSearch={handleSearch}
        onScanStart={handleScanStart}
      />
      {scanStatus && (
        <div className={`scan-banner scan-banner--${scanStatus}`}>
          {scanStatus === 'running' && 'Scanning library…'}
          {scanStatus === 'done' && (
            <>
              Scan complete
              {scanSummary != null
                ? ` · +${scanSummary.added} / −${scanSummary.removed} tracks`
                : ''}
            </>
          )}
          {scanStatus === 'error' && 'Scan failed'}
        </div>
      )}
      {searchResults && (
        <div className="search-overlay" onClick={closeSearch}>
          <div className="search-results" onClick={(e) => e.stopPropagation()}>
            {!searchResults.artists?.length &&
              !searchResults.albums?.length &&
              !searchResults.tracks?.length && (
                <div className="search-empty">
                  No results for &ldquo;{search.q}&rdquo;
                </div>
              )}
            {searchResults.artists?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Artists</div>
                {searchResults.artists.map((name) => (
                  <button
                    key={name}
                    className="search-item"
                    onClick={() => {
                      closeSearch();
                      navigate({ name: 'artist', artist: name });
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            {searchResults.albums?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Albums</div>
                {searchResults.albums.map((a) => (
                  <button
                    key={a.id}
                    className="search-item"
                    onClick={() => {
                      closeSearch();
                      navigate({ name: 'album', id: a.id });
                    }}
                  >
                    <span className="search-item-title">{a.album}</span>
                    <span className="search-item-sub">{a.albumartist}</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults.tracks?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Tracks</div>
                {searchResults.tracks.map((t) => (
                  <button
                    key={t.id}
                    className="search-item"
                    onClick={() => {
                      closeSearch();
                      navigate({ name: 'album', id: t.album_id });
                    }}
                  >
                    <span className="search-item-title">{t.title}</span>
                    <span className="search-item-sub">
                      {t.album} · {t.albumartist}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <main>
        {route.name === 'library' && <Library />}
        {route.name === 'artist' && (
          <Artist key={route.artist} name={route.artist} />
        )}
        {route.name === 'album' && <Album key={route.id} id={route.id} />}
        {route.name === 'untagged' && (
          <Untagged key={route.dir || '__index'} dir={route.dir} />
        )}
      </main>
    </div>
  );
}
