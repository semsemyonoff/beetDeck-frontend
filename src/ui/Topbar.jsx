import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import logoUrl from '../assets/logo.png';

const THEME_ORDER = ['auto', 'light', 'dark'];

function effectiveTheme(mode) {
  if (mode !== 'auto') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', effectiveTheme(mode));
}

export default function Topbar({ onNavHome, onSearch, onScanStart }) {
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem('theme') || 'auto'
  );
  const [query, setQuery] = useState('');
  const debounceRef = useRef(null);

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

  const onQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      if (!trimmed) {
        onSearch({ q: '', results: null });
        return;
      }
      try {
        const resp = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`
        );
        const data = resp.ok ? await resp.json() : null;
        onSearch({ q: trimmed, results: data });
      } catch (err) {
        onSearch({ q: trimmed, results: null, error: String(err) });
      }
    }, 200);
  };

  const themeIcon = effectiveTheme(themeMode) === 'light' ? 'sun' : 'moon';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="brand" onClick={onNavHome}>
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

      <div className="topbar-search">
        <Icon name="search" size={14} />
        <input
          placeholder="Search artists, albums, tracks…"
          value={query}
          onChange={onQueryChange}
        />
        <kbd className="kbd">⌘K</kbd>
      </div>

      <div className="topbar-right">
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
