import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import FolderTree from '../ui/FolderTree.jsx';
import TagTable from '../ui/TagTable.jsx';
import BulkBar from '../ui/BulkBar.jsx';
import UntaggedGroup from '../ui/UntaggedGroup.jsx';
import { useTagRows } from '../ui/useTagRows.js';
import { groupUntagged } from '../lib/tagEditor.js';
import { navigate } from '../useHashRoute.js';

function seedRow(f) {
  return {
    id: f.id,
    file: f.file,
    hint: f.file,
    track: f.track || '',
    title: f.title || '',
    artist: f.artist || '',
    album: f.album || '',
    albumartist: '',
    year: '',
    genre: '',
    path: f.path,
  };
}

function FolderEditor({ folder }) {
  const ed = useTagRows(folder.files.map(seedRow));
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);
  const flashTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const showFlash = (kind, text) => {
    setFlash({ kind, text });
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 2400);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const albumFields = {
        album: ed.summary.album,
        albumartist: ed.summary.albumArtist,
        year: ed.rows.map((r) => r.year).find((v) => v) || '',
        genre: ed.rows.map((r) => r.genre).find((v) => v) || '',
      };
      let warnings = [];
      await ed.commit(async (payload) => {
        const r = await fetch('/api/items/metadata-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
        warnings = d.warnings || [];
      }, albumFields);
      if (warnings.length) {
        showFlash('warn', warnings.join('; '));
      } else {
        showFlash('ok', 'Saved');
        setTimeout(() => navigate({ name: 'untagged' }), 800);
      }
    } catch (e) {
      showFlash('err', String(e));
    } finally {
      setSaving(false);
    }
  };

  const { canIdentify } = ed.summary;

  return (
    <>
      {flash && <div className={`flash flash-${flash.kind}`}>{flash.text}</div>}
      <FolderTree root={folder.root} folder={folder.name} files={folder.files} />
      <div className="tte-toolbar">
        <button
          className="btn btn-primary btn-sm"
          disabled={saving || ed.dirtyCount === 0}
          onClick={handleSave}
        >
          <Icon name="check" size={12} />{' '}
          {saving ? 'Saving…' : `Save${ed.dirtyCount > 0 ? ` (${ed.dirtyCount})` : ''}`}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!canIdentify}
          title={canIdentify ? undefined : 'Set Album and Album Artist first'}
          aria-label="Identify via MusicBrainz"
        >
          <Icon name="sparkles" size={12} /> Identify via MusicBrainz
        </button>
      </div>
      {!canIdentify && (
        <div className="tte-gate muted small">
          Set <strong>Album</strong> and <strong>Album Artist</strong> to enable identification.
        </div>
      )}
      <TagTable ed={ed} showFile />
      {ed.selected.size > 0 && (
        <BulkBar
          count={ed.selected.size}
          onApply={(vals) => ed.applyBulk(vals)}
          onClear={() => ed.clearSel()}
        />
      )}
    </>
  );
}

export default function Untagged({ dir }) {
  const [untaggedItems, setUntaggedItems] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/items/untagged');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setUntaggedItems(await r.json());
    } catch (e) {
      setFetchError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const folders = useMemo(() => groupUntagged(untaggedItems || []), [untaggedItems]);
  const folder = dir != null ? (folders.find((f) => f.dir === dir) ?? null) : null;

  if (fetchError) {
    return (
      <div className="page page-untagged">
        <div className="crumbs">
          <button className="crumb" onClick={() => navigate({ name: 'library' })}>
            <Icon name="arrow-left" size={12} /> Library
          </button>
        </div>
        <div className="error">Failed to load: {fetchError}</div>
      </div>
    );
  }

  if (untaggedItems === null) {
    return (
      <div className="page page-untagged">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (dir == null) {
    return (
      <div className="page page-untagged">
        <div className="crumbs">
          <button className="crumb" onClick={() => navigate({ name: 'library' })}>
            <Icon name="arrow-left" size={12} /> Library
          </button>
        </div>
        <header className="untagged-header">
          <div>
            <div className="page-eyebrow">
              <Icon name="alert" size={12} /> Loose files
            </div>
            <h1 className="page-title">Untagged</h1>
          </div>
        </header>
        {folders.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing to clean up</h2>
            <p className="muted">No untagged files found.</p>
          </div>
        ) : (
          <UntaggedGroup folders={folders} />
        )}
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="page page-untagged">
        <div className="crumbs">
          <button className="crumb" onClick={() => navigate({ name: 'untagged' })}>
            <Icon name="arrow-left" size={12} /> Untagged
          </button>
        </div>
        <div className="empty-state">
          <h2>Folder not found</h2>
          <p className="muted mono">{dir}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-untagged">
      <div className="crumbs">
        <button className="crumb" onClick={() => navigate({ name: 'library' })}>
          <Icon name="arrow-left" size={12} /> Library
        </button>
        <span className="crumb-sep">/</span>
        <button className="crumb" onClick={() => navigate({ name: 'untagged' })}>
          Untagged
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb crumb-current">{folder.name}</span>
      </div>
      <header className="untagged-header">
        <div>
          <div className="page-eyebrow">
            <Icon name="alert" size={12} /> Loose files
          </div>
          <h1 className="page-title">{folder.name}</h1>
        </div>
        <div className="untagged-stats">
          <div>
            <strong>{folder.files.length}</strong>
            <span className="muted small"> files</span>
          </div>
        </div>
      </header>
      <FolderEditor key={folder.dir} folder={folder} />
    </div>
  );
}
