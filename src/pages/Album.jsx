import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Cover } from '../ui/Cover.jsx';
import { navigate } from '../useHashRoute.js';
import IdentifyModal from '../ui/IdentifyModal.jsx';

function basename(p) {
  if (!p) return '';
  const parts = String(p).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function fmtMins(sec) {
  const m = Math.round((sec || 0) / 60);
  return `${m} min`;
}

function fmtTotal(sec) {
  if (!sec) return '0 min';
  const m = Math.floor(sec / 60);
  return `${m} min`;
}

function parseLength(str) {
  if (!str) return 0;
  const [m, s] = String(str).split(':').map(Number);
  if (Number.isNaN(m) || Number.isNaN(s)) return 0;
  return m * 60 + s;
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

export default function Album({ id }) {
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
  const uploadRef = useRef(null);

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
  }, [id, version]);

  const reload = () => setVersion((v) => v + 1);
  const refreshCover = () => setCoverV((v) => v + 1);

  const showFlash = (kind, text) => {
    setFlash({ kind, text });
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(null), 3500);
  };

  const stats = useMemo(() => {
    if (!data) return [];
    return (data.discs || []).map((d) => ({
      disc: d.disc,
      count: d.track_count,
      mins: Math.round((d.duration_sec || 0) / 60),
      sec: d.duration_sec || 0,
      dirName: basename(d.dir) || `CD${d.disc}`,
    }));
  }, [data]);

  const byDisc = useMemo(() => {
    if (!data) return [];
    const tracks = data.tracks || [];
    if (!stats.length) {
      return [{ disc: 1, count: tracks.length, mins: 0, dirName: '', tracks }];
    }
    return stats.map((s) => ({
      ...s,
      tracks: tracks.filter((t) => (t.disc || 1) === s.disc),
    }));
  }, [data, stats]);

  const totalSec = useMemo(() => {
    if (!data) return 0;
    return (data.tracks || []).reduce((acc, t) => acc + parseLength(t.length), 0);
  }, [data]);

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
  const genres = data.genre ? data.genre.split(',').map((s) => s.trim()).filter(Boolean) : [];

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
        setLyricsCache((prev) => ({ ...prev, [item.id]: { has_lyrics: false, error: String(e) } }));
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
      showFlash('ok', d?.ignored ? 'Marked as ignored.' : 'Cleared ignored flag.');
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
    const { ok, data: d } = await postJson(`/api/album/${data.id}/genre/confirm`);
    setBusy(null);
    setGenrePreview(null);
    if (ok) {
      showFlash('ok', `Genre saved: ${d?.genre || ''}`);
      reload();
    } else {
      showFlash('err', d?.error || 'Genre confirm failed.');
    }
  };
  const handleGenreSave = async () => {
    const value = (genreEdit || '').trim();
    if (!value) return;
    setBusy('genre-save');
    const { ok, data: d } = await postJson(`/api/album/${data.id}/genre/save`, { genre: value });
    setBusy(null);
    setGenreEdit(null);
    if (ok) {
      showFlash('ok', `Genre saved: ${d?.genre || value}`);
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
    const { ok, data: d } = await postJson(`/api/album/${data.id}/cover/confirm`);
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
      const r = await fetch(`/api/album/${data.id}/cover/upload`, { method: 'POST', body: form });
      ok = r.ok;
      try { respData = await r.json(); } catch { respData = null; }
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
    const { ok, data: d } = await postJson(`/api/album/${data.id}/lyrics/fetch`);
    if (!ok) {
      setBusy(null);
      showFlash('err', d?.error || 'Bulk lyrics fetch failed.');
      return;
    }
    const found = (d?.tracks || []).filter((t) => t.found && !t.current_lyrics);
    if (!found.length) {
      setBusy(null);
      showFlash('err', 'No lyrics found for any track.');
      return;
    }
    const item_ids = found.map((t) => t.item_id);
    const { ok: ok2, data: d2 } = await postJson(`/api/album/${data.id}/lyrics/confirm`, { item_ids });
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

  const coverImgSrc = data.has_cover
    ? `/api/album/${data.id}/cover?v=${coverV}`
    : null;

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

      {flash && (
        <div className={`flash flash-${flash.kind}`}>{flash.text}</div>
      )}

      <header className="album-hero">
        <div className="album-hero-cover">
          {coverImgSrc ? (
            <div
              className="cover"
              style={{ width: 260, height: 260, borderRadius: 8, flex: '0 0 260px' }}
            >
              <img
                src={coverImgSrc}
                alt=""
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
              />
            </div>
          ) : (
            <Cover album={album} size={260} rounded={8} showTitle={false} />
          )}
        </div>
        <div className="album-hero-text">
          <div className="album-hero-eyebrow">
            <Icon name="disc" size={12} /> Album
            {album.identified ? (
              <span className="badge badge-ok">
                <Icon name="check" size={10} /> identified
              </span>
            ) : null}
            {data.ignored ? <span className="badge badge-info">ignored</span> : null}
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
              {tracks.length} tracks{data.multi_disc ? ` across ${stats.length} discs` : ''}
            </span>
            <span className="dot">·</span>
            <span>{fmtTotal(totalSec)}</span>
          </div>

          {genres.length > 0 && (
            <div className="album-hero-tags">
              {genres.map((g) => (
                <span key={g} className="tag-chip">{g}</span>
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
                <dd className="mono">{data.mb_albumid}</dd>
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
                disabled={busy === 'ignore'}
                onClick={handleIgnore}
              >
                <Icon name="ignore" size={12} /> {data.ignored ? 'Unignore' : 'Ignore'}
              </button>
            </ActionGroup>
            <ActionGroup label="Genre">
              <button
                className="btn btn-action"
                disabled={busy === 'genre-fetch'}
                onClick={handleGenreFetch}
              >
                <Icon name="download" size={12} /> Fetch
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
                <Icon name="download" size={12} /> Fetch
              </button>
              <button
                className="btn btn-action"
                disabled={busy === 'cover-upload'}
                onClick={() => uploadRef.current?.click()}
              >
                <Icon name="upload" size={12} /> Upload
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
                <Icon name="download" size={12} /> Fetch all
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
                  className={'album-track-row' + (isOpen ? ' album-track-row-open' : '')}
                >
                  <div className="album-track-main">
                    <span className="td td-num">{String(trackNum).padStart(2, '0')}</span>
                    <span className="td td-title">{t.title || '—'}</span>
                    <span className="td td-artist">{t.artist || ''}</span>
                    <span className="td td-dur">{t.length || ''}</span>
                    <span className="td td-actions">
                      <button
                        className={'track-mini-btn' + (hasLyrics === false ? ' track-mini-btn-empty' : '')}
                        onClick={() => onLyricsExpand(t)}
                      >
                        <Icon name="lyrics" size={11} />{' '}
                        {hasLyrics === false ? 'no lyrics' : 'lyrics'}
                      </button>
                      <button className="track-mini-btn" onClick={() => openTagsModal(t)}>
                        <Icon name="tag" size={11} /> tags
                      </button>
                    </span>
                  </div>
                  {isOpen ? (
                    <div className="album-track-lyrics">
                      {lyrPayload == null ? (
                        <div className="muted small">Loading lyrics…</div>
                      ) : !lyrPayload.has_lyrics ? (
                        <div className="muted small">No lyrics for this track.</div>
                      ) : (
                        <>
                          <div className="lyrics-toolbar">
                            <span className="lyrics-badge">
                              <Icon name="check" size={10} /> {lyrPayload.source || 'embedded'}
                            </span>
                            <div className="lyrics-toolbar-actions">
                              <button
                                className="track-mini-btn"
                                onClick={() => openLyricsModal(t)}
                              >
                                expand ↗
                              </button>
                            </div>
                          </div>
                          <div className="lyrics-preview">
                            <pre className="lyrics-pre">
                              {(lyrPayload.lyrics || '').split('\n').slice(0, 8).join('\n')}
                            </pre>
                            <button className="lyrics-fade" onClick={() => openLyricsModal(t)}>
                              click to expand →
                            </button>
                          </div>
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
              <button className="btn-icon" onClick={() => setGenrePreview(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <dl className="diff-cells">
                <div>
                  <dt className="muted small">Current</dt>
                  <dd>{genrePreview.old || <span className="muted">empty</span>}</dd>
                </div>
                <div>
                  <dt className="muted small">Proposed</dt>
                  <dd>{genrePreview.next || <span className="muted">empty</span>}</dd>
                </div>
              </dl>
            </div>
            <div className="modal-foot">
              <div className="row-end">
                <button className="btn btn-ghost" onClick={() => setGenrePreview(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'genre-confirm'}
                  onClick={handleGenreConfirm}
                >
                  <Icon name="check" size={12} /> Confirm
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
                <button className="btn btn-ghost" onClick={() => setGenreEdit(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'genre-save' || !(genreEdit || '').trim()}
                  onClick={handleGenreSave}
                >
                  <Icon name="check" size={12} /> Save
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
                <div className="modal-eyebrow">Cover · {coverPreview.source}</div>
                <h3 className="modal-title">{album.title}</h3>
              </div>
              <button className="btn-icon" onClick={() => setCoverPreview(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img
                src={coverPreview.url}
                alt=""
                style={{ maxWidth: '320px', maxHeight: '320px', borderRadius: 8 }}
              />
            </div>
            <div className="modal-foot">
              <div className="row-end">
                <button className="btn btn-ghost" onClick={() => setCoverPreview(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'cover-confirm'}
                  onClick={handleCoverConfirm}
                >
                  <Icon name="check" size={12} /> Confirm
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
    </div>
  );
}

function LyricsModal({ item, payload, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lyrics" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Lyrics · {payload?.source || 'unknown'}</div>
            <h3 className="modal-title">{item.title}</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">
          {payload?.has_lyrics ? (
            <pre className="lyrics-pre lyrics-full">{payload.lyrics || ''}</pre>
          ) : (
            <div className="muted">No lyrics available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagsModal({ item, tags, error, onClose }) {
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
