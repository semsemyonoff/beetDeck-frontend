import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Cover } from '../ui/Cover.jsx';
import { navigate } from '../useHashRoute.js';
import IdentifyModal from '../ui/IdentifyModal.jsx';
import TagEditorModal from '../ui/TagEditorModal.jsx';
import {
  fmtMins,
  fmtTotal,
  parseLength,
  discStats,
  groupByDisc,
} from '../lib/disc.js';
import { buildLyricsPreview } from '../lib/diff.js';
import { isIdentified } from '../lib/albums.js';
import { isSynced, parseLyricLines } from '../lib/lyrics.js';
import { useModalDismiss } from '../lib/useModalDismiss.js';

// Render LRC lines as a [timestamp | text] grid; blank lines show a ♪ glyph.
function LyricLines({ text, limit }) {
  let lines = parseLyricLines(text);
  if (limit != null) lines = lines.slice(0, limit);
  return lines.map((ln, i) => {
    const blank = !ln.text.trim();
    return (
      <div
        key={i}
        className={'lyric-line' + (blank ? ' lyric-line-blank' : '')}
      >
        <span className="lyric-ts mono">{ln.ts ? `[${ln.ts}]` : ''}</span>
        <span className="lyric-text">{blank ? '♪' : ln.text}</span>
      </div>
    );
  });
}

// Small inline spinner shown inside a button while its action is running.
function BtnSpinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

function ActionGroup({ label, children }) {
  return (
    <div className="action-group">
      <span className="action-group-label">{label}</span>
      <div className="action-group-btns">{children}</div>
    </div>
  );
}

async function postJson(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  return { ok: resp.ok, status: resp.status, data };
}

export default function Album({ id, dataVersion = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(null); // string label of active action
  const [flash, setFlash] = useState(null); // { kind: 'ok'|'err', text }
  const [coverV, setCoverV] = useState(0); // bump to force cover img refetch
  const [expandedKey, setExpandedKey] = useState(null);
  const [lyricsCache, setLyricsCache] = useState({}); // item_id -> {has_lyrics, lyrics, source}
  const [lyricsModal, setLyricsModal] = useState(null); // {item, lyrics, source}
  const [tagsModal, setTagsModal] = useState(null); // {item, tags}
  const [genrePreview, setGenrePreview] = useState(null); // {old, new}
  const [genreEdit, setGenreEdit] = useState(null); // string
  const [coverPreview, setCoverPreview] = useState(null); // {source, url}
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [coverViewer, setCoverViewer] = useState(false);
  const [tagEditorModal, setTagEditorModal] = useState(null); // null | {focusTrack: id|null}
  const [lyricsEditState, setLyricsEditState] = useState({});
  const [lyricsFetchPreview, setLyricsFetchPreview] = useState({});
  const [trackBusy, setTrackBusy] = useState({});
  const [trackError, setTrackError] = useState({});
  const [heroCoverError, setHeroCoverError] = useState(false);
  const uploadRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

  const inlineModalClose =
    genrePreview !== null
      ? () => setGenrePreview(null)
      : genreEdit !== null
        ? () => setGenreEdit(null)
        : coverPreview !== null
          ? () => setCoverPreview(null)
          : tagEditorModal !== null
            ? () => setTagEditorModal(null)
            : coverViewer
              ? () => setCoverViewer(false)
              : null;
  useModalDismiss(inlineModalClose);

  useEffect(() => {
    let aborted = false;
    setData(null);
    setError(null);
    fetch(`/api/album/${id}`)
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
  }, [id, version, dataVersion]);

  const reload = () => setVersion((v) => v + 1);
  const refreshCover = () => setCoverV((v) => v + 1);

  const showFlash = (kind, text) => {
    setFlash({ kind, text });
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 3500);
  };

  const stats = useMemo(() => {
    if (!data) return [];
    return discStats(data.discs || []);
  }, [data]);

  const byDisc = useMemo(() => {
    if (!data) return [];
    return groupByDisc(data.tracks || [], stats);
  }, [data, stats]);

  const totalSec = useMemo(() => {
    if (!data) return 0;
    return (data.tracks || []).reduce(
      (acc, t) => acc + parseLength(t.length),
      0
    );
  }, [data]);

  const coverImgSrc = data?.has_cover
    ? `/api/album/${data.id}/cover?v=${coverV}`
    : null;

  useEffect(() => setHeroCoverError(false), [coverImgSrc]);

  if (error) {
    return (
      <div className="page page-album">
        <div className="error">Failed to load album: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page page-album">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  const album = {
    id: data.id,
    title: data.album,
    has_cover: data.has_cover,
    identified: !!(data.tagged || data.ignored),
  };
  const artistName = data.albumartist || '';
  const tracks = data.tracks || [];
  const genres = data.genre
    ? data.genre
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const onLyricsExpand = async (item) => {
    const key = `${item.disc || 1}:${item.id}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (!lyricsCache[item.id]) {
      try {
        const r = await fetch(`/api/album/${data.id}/track/${item.id}/lyrics`);
        const d = r.ok ? await r.json() : { has_lyrics: false };
        setLyricsCache((prev) => ({ ...prev, [item.id]: d }));
      } catch (e) {
        setLyricsCache((prev) => ({
          ...prev,
          [item.id]: { has_lyrics: false, error: String(e) },
        }));
      }
    }
  };

  const openLyricsModal = async (item) => {
    let payload = lyricsCache[item.id];
    if (!payload) {
      try {
        const r = await fetch(`/api/album/${data.id}/track/${item.id}/lyrics`);
        payload = r.ok ? await r.json() : { has_lyrics: false };
        setLyricsCache((prev) => ({ ...prev, [item.id]: payload }));
      } catch {
        payload = { has_lyrics: false };
      }
    }
    setLyricsModal({ item, payload });
  };

  const openTagsModal = async (item) => {
    setTagsModal({ item, tags: null, error: null });
    try {
      const r = await fetch(`/api/album/${data.id}/track/${item.id}/tags`);
      const tags = r.ok ? await r.json() : null;
      if (!r.ok) {
        setTagsModal({ item, tags: null, error: 'HTTP ' + r.status });
      } else {
        setTagsModal({ item, tags, error: null });
      }
    } catch (e) {
      setTagsModal({ item, tags: null, error: String(e) });
    }
  };

  const handleIgnore = async () => {
    setBusy('ignore');
    const { ok, data: d } = await postJson(`/api/album/${data.id}/ignore`);
    setBusy(null);
    if (ok) {
      showFlash(
        'ok',
        d?.ignored ? 'Marked as ignored.' : 'Cleared ignored flag.'
      );
      reload();
    } else {
      showFlash('err', d?.error || 'Ignore failed.');
    }
  };

  const handleGenreFetch = async () => {
    setBusy('genre-fetch');
    const { ok, data: d } = await postJson(`/api/album/${data.id}/genre`);
    setBusy(null);
    if (ok) {
      setGenrePreview({ old: d?.old_genre || '', next: d?.new_genre || '' });
    } else {
      showFlash('err', d?.error || 'Genre fetch failed.');
    }
  };
  const handleGenreConfirm = async () => {
    setBusy('genre-confirm');
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/genre/confirm`
    );
    setBusy(null);
    setGenrePreview(null);
    if (ok) {
      const partial = d?.status === 'partial';
      showFlash(
        partial ? 'warn' : 'ok',
        `Genre saved: ${d?.genre || ''}${partial ? ' (partial write)' : ''}`
      );
      reload();
    } else {
      showFlash('err', d?.error || 'Genre confirm failed.');
    }
  };
  const handleGenreSave = async () => {
    const value = (genreEdit || '').trim();
    if (!value) return;
    setBusy('genre-save');
    const { ok, data: d } = await postJson(`/api/album/${data.id}/genre/save`, {
      genre: value,
    });
    setBusy(null);
    setGenreEdit(null);
    if (ok) {
      const partial = d?.status === 'partial';
      showFlash(
        partial ? 'warn' : 'ok',
        `Genre saved: ${d?.genre || value}${partial ? ' (partial write)' : ''}`
      );
      reload();
    } else {
      showFlash('err', d?.error || 'Genre save failed.');
    }
  };

  const handleCoverFetch = async () => {
    setBusy('cover-fetch');
    const { ok, data: d } = await postJson(`/api/album/${data.id}/cover/fetch`);
    setBusy(null);
    if (!ok) {
      showFlash('err', d?.error || 'Cover fetch failed.');
      return;
    }
    if (!d?.found) {
      showFlash('err', 'No cover art found online.');
      return;
    }
    setCoverPreview({
      source: d.source,
      url: `/api/album/${data.id}/cover/preview?v=${Date.now()}`,
    });
  };
  const handleCoverConfirm = async () => {
    setBusy('cover-confirm');
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/cover/confirm`
    );
    setBusy(null);
    setCoverPreview(null);
    if (ok) {
      showFlash('ok', 'Cover saved.');
      refreshCover();
      reload();
    } else {
      showFlash('err', d?.error || 'Cover confirm failed.');
    }
  };
  const handleCoverUpload = async (file) => {
    if (!file) return;
    setBusy('cover-upload');
    const form = new FormData();
    form.append('file', file);
    let respData = null;
    let ok = false;
    try {
      const r = await fetch(`/api/album/${data.id}/cover/upload`, {
        method: 'POST',
        body: form,
      });
      ok = r.ok;
      try {
        respData = await r.json();
      } catch {
        respData = null;
      }
    } catch (e) {
      respData = { error: String(e) };
    }
    setBusy(null);
    if (ok) {
      showFlash('ok', 'Cover uploaded.');
      refreshCover();
      reload();
    } else {
      showFlash('err', respData?.error || 'Cover upload failed.');
    }
  };

  const handleLyricsFetchAll = async () => {
    setBusy('lyrics-fetch');
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/lyrics/fetch`
    );
    if (!ok) {
      setBusy(null);
      showFlash('err', d?.error || 'Bulk lyrics fetch failed.');
      return;
    }
    const allTracks = d?.tracks || [];
    const found = allTracks.filter((t) => t.found && !t.current_lyrics);
    if (!found.length) {
      setBusy(null);
      const anyFound = allTracks.some((t) => t.found);
      showFlash(
        'err',
        anyFound
          ? 'All tracks already have lyrics.'
          : 'No lyrics found for any track.'
      );
      return;
    }
    const item_ids = found.map((t) => t.item_id);
    const { ok: ok2, data: d2 } = await postJson(
      `/api/album/${data.id}/lyrics/confirm`,
      { item_ids }
    );
    setBusy(null);
    if (ok2) {
      const failed = (d2?.failed || []).length;
      showFlash(
        failed ? 'err' : 'ok',
        `Wrote lyrics for ${d2?.written || 0} track(s)${failed ? `, ${failed} failed` : ''}.`
      );
      // Refresh lyrics cache for affected items.
      setLyricsCache({});
      reload();
    } else {
      showFlash('err', d2?.error || 'Lyrics confirm failed.');
    }
  };

  const setTrackBusyForId = (id, val) =>
    setTrackBusy((prev) => ({ ...prev, [id]: val }));

  const setTrackErrorForId = (id, msg) =>
    setTrackError((prev) => ({ ...prev, [id]: msg || null }));

  const refreshTrackLyrics = async (item) => {
    try {
      const r = await fetch(`/api/album/${data.id}/track/${item.id}/lyrics`);
      const payload = r.ok ? await r.json() : { has_lyrics: false };
      setLyricsCache((prev) => ({ ...prev, [item.id]: payload }));
    } catch {
      setLyricsCache((prev) => ({ ...prev, [item.id]: { has_lyrics: false } }));
    }
  };

  const startLyricsEdit = (item) => {
    const payload = lyricsCache[item.id];
    setLyricsEditState((prev) => ({
      ...prev,
      [item.id]: payload?.lyrics || '',
    }));
    setTrackErrorForId(item.id, null);
  };

  const cancelLyricsEdit = (item) => {
    setLyricsEditState((prev) => {
      const n = { ...prev };
      delete n[item.id];
      return n;
    });
  };

  const handleTrackLyricsSave = async (item) => {
    const text = lyricsEditState[item.id] ?? '';
    setTrackBusyForId(item.id, 'save');
    setTrackErrorForId(item.id, null);
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/track/${item.id}/lyrics/save`,
      { lyrics: text }
    );
    setTrackBusyForId(item.id, null);
    if (ok) {
      cancelLyricsEdit(item);
      showFlash('ok', 'Lyrics saved.');
      await refreshTrackLyrics(item);
    } else {
      setTrackErrorForId(item.id, d?.error || 'Failed to save lyrics.');
    }
  };

  const handleTrackLyricsFetchOnline = async (item) => {
    setTrackBusyForId(item.id, 'fetch');
    setTrackErrorForId(item.id, null);
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/track/${item.id}/lyrics/fetch`
    );
    setTrackBusyForId(item.id, null);
    if (!ok) {
      setTrackErrorForId(item.id, d?.error || 'Lyrics fetch failed.');
      return;
    }
    if (!d?.found) {
      setTrackErrorForId(item.id, 'No lyrics found online.');
      return;
    }
    const current = lyricsCache[item.id]?.lyrics || d.current_lyrics || '';
    const preview = buildLyricsPreview(current, d.new_lyrics || '');
    setLyricsFetchPreview((prev) => ({ ...prev, [item.id]: preview }));
  };

  const cancelLyricsFetchPreview = (item) => {
    setLyricsFetchPreview((prev) => {
      const n = { ...prev };
      delete n[item.id];
      return n;
    });
  };

  const handleTrackLyricsConfirmFetch = async (item) => {
    setTrackBusyForId(item.id, 'confirm');
    setTrackErrorForId(item.id, null);
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/track/${item.id}/lyrics/confirm`
    );
    setTrackBusyForId(item.id, null);
    if (ok) {
      cancelLyricsFetchPreview(item);
      showFlash('ok', 'Lyrics saved.');
      await refreshTrackLyrics(item);
    } else {
      setTrackErrorForId(item.id, d?.error || 'Lyrics confirm failed.');
    }
  };

  const handleTrackLyricsEmbed = async (item) => {
    setTrackBusyForId(item.id, 'embed');
    setTrackErrorForId(item.id, null);
    const { ok, data: d } = await postJson(
      `/api/album/${data.id}/track/${item.id}/lyrics/embed`
    );
    setTrackBusyForId(item.id, null);
    if (ok) {
      showFlash('ok', 'Lyrics embedded from .lrc.');
      await refreshTrackLyrics(item);
    } else {
      setTrackErrorForId(item.id, d?.error || 'Embed .lrc failed.');
    }
  };

  return (
    <div className="page page-album">
      <div className="crumbs">
        <button className="crumb" onClick={() => navigate({ name: 'library' })}>
          <Icon name="arrow-left" size={12} /> Library
        </button>
        {artistName && (
          <>
            <span className="crumb-sep">/</span>
            <button
              className="crumb"
              onClick={() => navigate({ name: 'artist', artist: artistName })}
            >
              {artistName}
            </button>
          </>
        )}
      </div>

      {flash && <div className={`flash flash-${flash.kind}`}>{flash.text}</div>}

      <header className="album-hero">
        <div className="album-hero-cover">
          {coverImgSrc && !heroCoverError ? (
            <div
              className="cover cover-zoomable"
              role="button"
              tabIndex={0}
              aria-label="View cover at full size"
              onClick={() => setCoverViewer(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCoverViewer(true);
                }
              }}
              style={{
                width: 260,
                height: 260,
                borderRadius: 8,
                flex: '0 0 260px',
              }}
            >
              <img
                src={coverImgSrc}
                alt=""
                onError={() => setHeroCoverError(true)}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
              <span className="cover-zoom-hint">
                <Icon name="search" size={16} />
              </span>
            </div>
          ) : (
            <Cover
              album={{ ...album, has_cover: false }}
              size={260}
              rounded={8}
              showTitle={false}
            />
          )}
        </div>
        <div className="album-hero-text">
          <div className="album-hero-eyebrow">
            <Icon name="disc" size={12} /> Album
            {isIdentified(data) ? (
              <span className="badge badge-ok">
                <Icon name="check" size={10} /> identified
              </span>
            ) : null}
            {data.ignored ? (
              <span className="badge badge-warn">
                <Icon name="check" size={10} /> ignored
              </span>
            ) : null}
            {data.multi_disc ? (
              <span className="badge badge-info">{stats.length}-disc</span>
            ) : null}
          </div>
          <h1 className="album-hero-title">{album.title}</h1>
          <div className="album-hero-byline">
            <span className="album-hero-artist">{artistName}</span>
            {data.year ? (
              <>
                <span className="dot">·</span>
                <span>{data.year}</span>
              </>
            ) : null}
            <span className="dot">·</span>
            <span>
              {tracks.length} tracks
              {data.multi_disc ? ` across ${stats.length} discs` : ''}
            </span>
            <span className="dot">·</span>
            <span>{fmtTotal(totalSec)}</span>
          </div>

          {genres.length > 0 && (
            <div className="album-hero-tags">
              {genres.map((g) => (
                <span key={g} className="tag-chip">
                  {g}
                </span>
              ))}
            </div>
          )}

          <dl className="album-hero-meta">
            {data.label ? (
              <div>
                <dt>Label</dt>
                <dd>{data.label}</dd>
              </div>
            ) : null}
            {data.mb_albumid ? (
              <div>
                <dt>MusicBrainz</dt>
                <dd className="mono">
                  <a
                    className="mb-link"
                    href={`https://musicbrainz.org/release/${data.mb_albumid}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open release on MusicBrainz"
                  >
                    {data.mb_albumid} ↗
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Path</dt>
              <dd className="mono path">
                {data.path || ''}
                {data.multi_disc ? (
                  <div className="path-tree">
                    {stats.map((s, i) => (
                      <div key={s.disc} className="path-tree-row">
                        <span className="path-tree-stem">
                          {i === stats.length - 1 ? '└─' : '├─'}
                        </span>
                        <span className="path-tree-name">{s.dirName}/</span>
                        <span className="path-tree-meta">
                          {s.count} tracks · {fmtMins(s.sec)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="album-hero-actions">
            <ActionGroup label="Tags">
              <button
                className="btn btn-action"
                disabled={!!busy}
                onClick={() => setIdentifyOpen(true)}
              >
                <Icon name="sparkles" size={12} /> Identify
              </button>
              <button
                className="btn btn-action"
                onClick={() => setTagEditorModal({ focusTrack: null })}
              >
                <Icon name="edit" size={12} /> Edit tags
              </button>
              <button
                className="btn btn-action"
                disabled={busy === 'ignore'}
                onClick={handleIgnore}
              >
                <Icon name="ignore" size={12} />{' '}
                {data.ignored ? 'Unignore' : 'Ignore'}
              </button>
            </ActionGroup>
            <ActionGroup label="Genre">
              <button
                className="btn btn-action"
                disabled={busy === 'genre-fetch'}
                onClick={handleGenreFetch}
              >
                {busy === 'genre-fetch' ? (
                  <BtnSpinner />
                ) : (
                  <Icon name="download" size={12} />
                )}{' '}
                Fetch
              </button>
              <button
                className="btn btn-action"
                onClick={() => setGenreEdit(data.genre || '')}
              >
                <Icon name="edit" size={12} /> Edit
              </button>
            </ActionGroup>
            <ActionGroup label="Cover">
              <button
                className="btn btn-action"
                disabled={busy === 'cover-fetch'}
                onClick={handleCoverFetch}
              >
                {busy === 'cover-fetch' ? (
                  <BtnSpinner />
                ) : (
                  <Icon name="download" size={12} />
                )}{' '}
                Fetch
              </button>
              <button
                className="btn btn-action"
                disabled={busy === 'cover-upload'}
                onClick={() => uploadRef.current?.click()}
              >
                {busy === 'cover-upload' ? (
                  <BtnSpinner />
                ) : (
                  <Icon name="upload" size={12} />
                )}{' '}
                Upload
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  handleCoverUpload(f);
                }}
              />
            </ActionGroup>
            <ActionGroup label="Lyrics">
              <button
                className="btn btn-action"
                disabled={busy === 'lyrics-fetch'}
                onClick={handleLyricsFetchAll}
              >
                {busy === 'lyrics-fetch' ? (
                  <BtnSpinner />
                ) : (
                  <Icon name="download" size={12} />
                )}{' '}
                Fetch all
              </button>
            </ActionGroup>
          </div>
        </div>
      </header>

      <section className="album-tracks">
        <div className="album-tracks-head">
          <span className="th th-num">#</span>
          <span className="th th-title">Title</span>
          <span className="th th-artist">Artist</span>
          <span className="th th-dur">Duration</span>
          <span className="th th-actions"></span>
        </div>

        {byDisc.map((d) => (
          <div key={d.disc} className="disc-section">
            {data.multi_disc ? (
              <div className="disc-section-head">
                <span className="disc-section-badge">
                  <Icon name="disc" size={11} /> Disc {d.disc}
                </span>
                <span className="disc-section-meta mono">
                  {d.dirName}/ · {d.count} tracks · {fmtMins(d.sec)}
                </span>
              </div>
            ) : null}
            {d.tracks.map((t, i) => {
              const rowKey = `${t.disc || 1}:${t.id}`;
              const isOpen = expandedKey === rowKey;
              const lyrPayload = lyricsCache[t.id];
              const hasLyrics = lyrPayload ? lyrPayload.has_lyrics : null;
              const trackNum = t.track || i + 1;
              return (
                <div
                  key={t.id}
                  className={
                    'album-track-row' + (isOpen ? ' album-track-row-open' : '')
                  }
                >
                  <div className="album-track-main">
                    <span className="td td-num">
                      {String(trackNum).padStart(2, '0')}
                    </span>
                    <span className="td td-title">{t.title || '—'}</span>
                    <span className="td td-artist">{t.artist || ''}</span>
                    <span className="td td-dur">{t.length || ''}</span>
                    <span className="td td-actions">
                      <button
                        className={
                          'track-mini-btn' +
                          (hasLyrics === false ? ' track-mini-btn-empty' : '')
                        }
                        onClick={() => onLyricsExpand(t)}
                      >
                        <Icon name="lyrics" size={11} />{' '}
                        {hasLyrics === false ? 'no lyrics' : 'lyrics'}
                      </button>
                      <button
                        className="track-mini-btn"
                        onClick={() => openTagsModal(t)}
                      >
                        <Icon name="tag" size={11} /> tags
                      </button>
                      <button
                        className="track-mini-btn"
                        onClick={() => setTagEditorModal({ focusTrack: t.id })}
                      >
                        <Icon name="edit" size={11} /> edit
                      </button>
                    </span>
                  </div>
                  {isOpen ? (
                    <div className="album-track-lyrics">
                      {lyrPayload == null ? (
                        <div className="muted small">Loading lyrics…</div>
                      ) : (
                        <>
                          {trackError[t.id] && (
                            <div className="track-lyrics-error">
                              {trackError[t.id]}
                            </div>
                          )}
                          {lyricsEditState[t.id] !== undefined ? (
                            <div className="lyrics-edit-area">
                              <textarea
                                className="form-input lyrics-edit-textarea"
                                value={lyricsEditState[t.id]}
                                rows={8}
                                onChange={(e) =>
                                  setLyricsEditState((prev) => ({
                                    ...prev,
                                    [t.id]: e.target.value,
                                  }))
                                }
                              />
                              <div className="lyrics-edit-actions">
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => cancelLyricsEdit(t)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-primary"
                                  disabled={!!trackBusy[t.id]}
                                  onClick={() => handleTrackLyricsSave(t)}
                                >
                                  {trackBusy[t.id] === 'save' ? (
                                    <BtnSpinner />
                                  ) : (
                                    <Icon name="check" size={12} />
                                  )}{' '}
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : lyricsFetchPreview[t.id] ? (
                            <div className="lyrics-fetch-preview">
                              <div className="lyrics-fetch-compare">
                                <div>
                                  <div className="muted small">Current</div>
                                  <pre className="lyrics-pre lyrics-compare-pane">
                                    {lyricsFetchPreview[t.id].old || '(empty)'}
                                  </pre>
                                </div>
                                <div>
                                  <div className="muted small">
                                    Found online
                                  </div>
                                  <pre className="lyrics-pre lyrics-compare-pane">
                                    {lyricsFetchPreview[t.id].new}
                                  </pre>
                                </div>
                              </div>
                              <div className="lyrics-edit-actions">
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => cancelLyricsFetchPreview(t)}
                                >
                                  Discard
                                </button>
                                <button
                                  className="btn btn-primary"
                                  disabled={!!trackBusy[t.id]}
                                  onClick={() =>
                                    handleTrackLyricsConfirmFetch(t)
                                  }
                                >
                                  {trackBusy[t.id] === 'confirm' ? (
                                    <BtnSpinner />
                                  ) : (
                                    <Icon name="check" size={12} />
                                  )}{' '}
                                  Confirm
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="lyrics-toolbar">
                                {lyrPayload.has_lyrics ? (
                                  <span className="lyrics-badge">
                                    <Icon name="check" size={10} />{' '}
                                    {lyrPayload.source || 'embedded'}
                                    {isSynced(lyrPayload.lyrics)
                                      ? ' · synced'
                                      : ''}
                                  </span>
                                ) : (
                                  <span className="muted small">
                                    No lyrics for this track.
                                  </span>
                                )}
                                <div className="lyrics-toolbar-actions">
                                  <button
                                    className="track-mini-btn"
                                    disabled={!!trackBusy[t.id]}
                                    onClick={() => startLyricsEdit(t)}
                                  >
                                    <Icon name="edit" size={11} /> edit
                                  </button>
                                  <button
                                    className="track-mini-btn"
                                    disabled={!!trackBusy[t.id]}
                                    onClick={() =>
                                      handleTrackLyricsFetchOnline(t)
                                    }
                                  >
                                    {trackBusy[t.id] === 'fetch' ? (
                                      <BtnSpinner />
                                    ) : (
                                      <Icon name="download" size={11} />
                                    )}{' '}
                                    fetch online
                                  </button>
                                  {t.has_lrc && (
                                    <button
                                      className="track-mini-btn"
                                      disabled={!!trackBusy[t.id]}
                                      onClick={() => handleTrackLyricsEmbed(t)}
                                    >
                                      {trackBusy[t.id] === 'embed' ? (
                                        <>
                                          <BtnSpinner /> embed .lrc
                                        </>
                                      ) : (
                                        'embed .lrc'
                                      )}
                                    </button>
                                  )}
                                  {lyrPayload.has_lyrics && (
                                    <button
                                      className="track-mini-btn"
                                      onClick={() => openLyricsModal(t)}
                                    >
                                      expand ↗
                                    </button>
                                  )}
                                </div>
                              </div>
                              {lyrPayload.has_lyrics && (
                                <div className="lyrics-preview">
                                  {isSynced(lyrPayload.lyrics) ? (
                                    <LyricLines
                                      text={lyrPayload.lyrics}
                                      limit={8}
                                    />
                                  ) : (
                                    <pre className="lyrics-pre">
                                      {(lyrPayload.lyrics || '')
                                        .split('\n')
                                        .slice(0, 8)
                                        .join('\n')}
                                    </pre>
                                  )}
                                  <button
                                    className="lyrics-fade"
                                    onClick={() => openLyricsModal(t)}
                                  >
                                    click to expand →
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {genrePreview && (
        <div className="modal-backdrop" onClick={() => setGenrePreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-eyebrow">Genre · Last.fm preview</div>
                <h3 className="modal-title">{album.title}</h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => setGenrePreview(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <dl className="genre-preview-dl">
                <div>
                  <dt className="muted small">Current</dt>
                  <dd>
                    {genrePreview.old || <span className="muted">empty</span>}
                  </dd>
                </div>
                <div>
                  <dt className="muted small">Proposed</dt>
                  <dd>
                    {genrePreview.next || <span className="muted">empty</span>}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="modal-foot">
              <div className="row-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => setGenrePreview(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'genre-confirm'}
                  onClick={handleGenreConfirm}
                >
                  {busy === 'genre-confirm' ? (
                    <BtnSpinner />
                  ) : (
                    <Icon name="check" size={12} />
                  )}{' '}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {genreEdit !== null && (
        <div className="modal-backdrop" onClick={() => setGenreEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-eyebrow">Genre · edit</div>
                <h3 className="modal-title">{album.title}</h3>
              </div>
              <button className="btn-icon" onClick={() => setGenreEdit(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-field">
                <span className="form-label">Genres (comma-separated)</span>
                <input
                  className="form-input"
                  value={genreEdit}
                  onChange={(e) => setGenreEdit(e.target.value)}
                  placeholder="e.g. Sludge Metal, Progressive Metal"
                />
              </label>
            </div>
            <div className="modal-foot">
              <div className="row-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => setGenreEdit(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'genre-save' || !(genreEdit || '').trim()}
                  onClick={handleGenreSave}
                >
                  {busy === 'genre-save' ? (
                    <BtnSpinner />
                  ) : (
                    <Icon name="check" size={12} />
                  )}{' '}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {coverPreview && (
        <div className="modal-backdrop" onClick={() => setCoverPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-eyebrow">
                  Cover · {coverPreview.source}
                </div>
                <h3 className="modal-title">{album.title}</h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => setCoverPreview(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img
                src={coverPreview.url}
                alt=""
                style={{
                  maxWidth: '320px',
                  maxHeight: '320px',
                  borderRadius: 8,
                }}
              />
            </div>
            <div className="modal-foot">
              <div className="row-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => setCoverPreview(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'cover-confirm'}
                  onClick={handleCoverConfirm}
                >
                  {busy === 'cover-confirm' ? (
                    <BtnSpinner />
                  ) : (
                    <Icon name="check" size={12} />
                  )}{' '}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lyricsModal && (
        <LyricsModal
          item={lyricsModal.item}
          payload={lyricsModal.payload}
          onClose={() => setLyricsModal(null)}
          onEdit={() => {
            const it = lyricsModal.item;
            setLyricsModal(null);
            setExpandedKey(`${it.disc || 1}:${it.id}`);
            startLyricsEdit(it);
          }}
          onRefetch={() => {
            const it = lyricsModal.item;
            setLyricsModal(null);
            setExpandedKey(`${it.disc || 1}:${it.id}`);
            handleTrackLyricsFetchOnline(it);
          }}
        />
      )}

      {tagsModal && (
        <TagsModal
          item={tagsModal.item}
          tags={tagsModal.tags}
          error={tagsModal.error}
          onClose={() => setTagsModal(null)}
        />
      )}

      {identifyOpen && (
        <IdentifyModal
          albumId={data.id}
          artistName={artistName}
          albumTitle={album.title}
          albumYear={data.year}
          onClose={() => setIdentifyOpen(false)}
          onConfirmed={() => {
            showFlash('ok', 'Tags applied.');
            refreshCover();
            reload();
          }}
        />
      )}

      {coverViewer && coverImgSrc && (
        <div
          className="cover-viewer-backdrop"
          onClick={() => setCoverViewer(false)}
        >
          <button
            className="btn-icon cover-viewer-close"
            onClick={() => setCoverViewer(false)}
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
          <img
            className="cover-viewer-img"
            src={coverImgSrc}
            alt={album.title}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {tagEditorModal && (
        <TagEditorModal
          album={data}
          focusTrack={tagEditorModal.focusTrack}
          onClose={() => setTagEditorModal(null)}
          onSaved={(res) => {
            const warnings = res?.warnings || [];
            if (warnings.length) {
              showFlash(
                'warn',
                `Tags saved with warnings: ${warnings.join('; ')}`
              );
            } else {
              showFlash('ok', 'Tags saved.');
            }
            reload();
          }}
        />
      )}
    </div>
  );
}

function LyricsModal({ item, payload, onClose, onEdit, onRefetch }) {
  useModalDismiss(onClose);
  const text = payload?.lyrics || '';
  const hasLyrics = !!payload?.has_lyrics;
  const synced = hasLyrics && isSynced(text);
  const source = payload?.source || 'unknown';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lyrics" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              Lyrics · {synced ? 'synced' : source}
            </div>
            <h3 className="modal-title">{item.title}</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">
          {!hasLyrics ? (
            <div className="muted">No lyrics available.</div>
          ) : synced ? (
            <div className="lyrics-full">
              <LyricLines text={text} />
            </div>
          ) : (
            <pre className="lyrics-pre lyrics-full">{text}</pre>
          )}
        </div>
        {hasLyrics && (
          <div className="modal-foot">
            <span className="muted small">
              From <strong>{source}</strong> · {text.length} chars
            </span>
            <div className="row-end">
              <button className="btn btn-ghost" onClick={onEdit}>
                <Icon name="edit" size={12} /> Edit
              </button>
              <button className="btn btn-ghost" onClick={onRefetch}>
                <Icon name="refresh" size={12} /> Re-fetch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TagsModal({ item, tags, error, onClose }) {
  useModalDismiss(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Tags</div>
            <h3 className="modal-title">{item.title}</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">
          {error ? (
            <div className="error">Failed to load tags: {error}</div>
          ) : tags == null ? (
            <div className="muted">Loading…</div>
          ) : (
            <dl className="tag-list">
              {Object.entries(tags)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <div key={k} className="tag-row">
                    <dt className="mono small muted">{k}</dt>
                    <dd className="mono small">{String(v)}</dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
