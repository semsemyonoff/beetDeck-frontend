import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Cover } from './Cover.jsx';
import { navigate } from '../useHashRoute.js';
import { searchShortcut } from '../lib/platform.js';
import logoUrl from '../assets/logo.png';

const THEME_ORDER = ['auto', 'light', 'dark'];

// OS-aware search shortcut (⌘K on mac, Ctrl K elsewhere). Computed once at
// module load; the platform does not change during a session.
const SHORTCUT = searchShortcut();

function effectiveTheme(mode) {
  if (mode !== 'auto') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', effectiveTheme(mode));
}

export default function Topbar({ onNavHome, onScanStart, version }) {
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem('theme') || 'auto'
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = dropdown closed
  const debounceRef = useRef(null);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem('theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (themeMode === 'auto') applyTheme('auto');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [themeMode]);

  // Close the dropdown on a click outside the search box (no backdrop element,
  // so the input stays clickable while the dropdown is open).
  useEffect(() => {
    if (!results) return undefined;
    const onDocClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setResults(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [results]);

  // Global search hotkey (⌘K / Ctrl K). Bound in the capture phase to maximise
  // the chance of winning against a browser's native Ctrl+K before it focuses
  // the URL/search bar. Independent of the outside-click listener above.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!SHORTCUT.matches(e)) return;
      e.preventDefault();
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const cycleTheme = () => {
    setThemeMode(
      (prev) =>
        THEME_ORDER[(THEME_ORDER.indexOf(prev) + 1) % THEME_ORDER.length]
    );
  };

  const startScan = async (mode) => {
    try {
      const resp = await fetch(`/api/rescan?mode=${mode}`, { method: 'POST' });
      const data = await resp.json().catch(() => ({}));
      if (onScanStart) onScanStart({ mode, ok: resp.ok, data });
    } catch (err) {
      if (onScanStart) onScanStart({ mode, ok: false, error: String(err) });
    }
  };

  const closeSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults(null);
  };

  const goTo = (target) => {
    closeSearch();
    navigate(target);
  };

  const onQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      if (!trimmed) {
        setResults(null);
        return;
      }
      try {
        const resp = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`
        );
        setResults(resp.ok ? await resp.json() : null);
      } catch {
        setResults(null);
      }
    }, 200);
  };

  const themeIcon = effectiveTheme(themeMode) === 'light' ? 'sun' : 'moon';
  const hasResults =
    results &&
    (results.artists?.length ||
      results.albums?.length ||
      results.tracks?.length);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="brand"
          onClick={() => {
            closeSearch();
            onNavHome();
          }}
        >
          <img src={logoUrl} alt="" className="brand-logo" />
          <span className="brand-name">beetDeck</span>
        </button>
        <div className="topbar-divider" />
        <button className="btn btn-ghost" onClick={() => startScan('quick')}>
          <Icon name="zap" size={14} /> Quick Scan
        </button>
        <button className="btn btn-primary" onClick={() => startScan('full')}>
          <Icon name="scan" size={14} /> Full Scan
        </button>
      </div>

      <div className="topbar-search" ref={searchRef}>
        <Icon name="search" size={14} />
        <input
          ref={inputRef}
          placeholder="Search artists, albums, tracks…"
          value={query}
          onChange={onQueryChange}
          onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
        />
        {results && (
          <div className="search-results">
            {!hasResults && (
              <div className="search-empty">
                No results for &ldquo;{query.trim()}&rdquo;
              </div>
            )}
            {results.artists?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Artists</div>
                {results.artists.map((name) => (
                  <button
                    key={name}
                    className="search-item"
                    onClick={() => goTo({ name: 'artist', artist: name })}
                  >
                    <span className="search-item-text">
                      <span className="search-item-title">{name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {results.albums?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Albums</div>
                {results.albums.map((a) => (
                  <button
                    key={a.id}
                    className="search-item"
                    onClick={() => goTo({ name: 'album', id: a.id })}
                  >
                    <Cover album={a} size={40} rounded={4} showTitle={false} />
                    <span className="search-item-text">
                      <span className="search-item-title">{a.album}</span>
                      <span className="search-item-sub">{a.albumartist}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {results.tracks?.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Tracks</div>
                {results.tracks.map((t) => (
                  <button
                    key={t.id}
                    className="search-item"
                    onClick={() => goTo({ name: 'album', id: t.album_id })}
                  >
                    <Cover
                      album={{
                        id: t.album_id,
                        album: t.album,
                        has_cover: t.has_cover,
                      }}
                      size={40}
                      rounded={4}
                      showTitle={false}
                    />
                    <span className="search-item-text">
                      <span className="search-item-title">{t.title}</span>
                      <span className="search-item-sub">
                        {t.album} · {t.albumartist}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <span className="kbd">{SHORTCUT.label}</span>
      </div>

      <div className="topbar-right">
        {version && (
          <span
            className="topbar-version"
            title={`beetDeck v${version.beetdeck} · beets ${version.beets}`}
          >
            v{version.beetdeck} · beets {version.beets}
          </span>
        )}
        <button
          className="btn-icon"
          aria-label={`Theme: ${themeMode}`}
          title={`Theme: ${themeMode}`}
          onClick={cycleTheme}
        >
          <Icon name={themeIcon} size={14} />
        </button>
      </div>
    </header>
  );
}
