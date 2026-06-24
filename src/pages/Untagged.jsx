import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import FolderTree from '../ui/FolderTree.jsx';
import TagTable from '../ui/TagTable.jsx';
import BulkBar from '../ui/BulkBar.jsx';
import UntaggedGroup from '../ui/UntaggedGroup.jsx';
import ItemsIdentifyModal from '../ui/ItemsIdentifyModal.jsx';
import { useTagRows } from '../ui/useTagRows.js';
import { groupUntagged } from '../lib/tagEditor.js';
import { navigate } from '../useHashRoute.js';
import RouteLink from '../ui/RouteLink.jsx';

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
  const [identifyOpen, setIdentifyOpen] = useState(false);
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
      <FolderTree
        root={folder.root}
        folder={folder.name}
        files={folder.files}
      />
      <div className="tte-toolbar">
        <div className="tte-toolbar-status">
          <span className="tte-resolved-k">album</span>
          {ed.summary.album ? (
            <span className="tte-resolved-v">{ed.summary.album}</span>
          ) : (
            <span className="tte-resolved-empty">not set</span>
          )}
          <span className="tte-resolved-k">album artist</span>
          {ed.summary.albumArtist ? (
            <span className="tte-resolved-v">{ed.summary.albumArtist}</span>
          ) : (
            <span className="tte-resolved-empty">not set</span>
          )}
        </div>
        <div className="tte-toolbar-actions">
          <button
            className="btn btn-primary btn-sm"
            disabled={saving || ed.dirtyCount === 0}
            onClick={handleSave}
          >
            <Icon name="check" size={12} />{' '}
            {saving
              ? 'Saving…'
              : `Save${ed.dirtyCount > 0 ? ` (${ed.dirtyCount})` : ''}`}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!canIdentify}
            title={canIdentify ? undefined : 'Set Album and Album Artist first'}
            aria-label="Identify via MusicBrainz"
            onClick={canIdentify ? () => setIdentifyOpen(true) : undefined}
          >
            <Icon name="sparkles" size={12} /> Identify via MusicBrainz
          </button>
        </div>
      </div>
      {!canIdentify && (
        <div className="tte-gate muted small">
          Set <strong>Album</strong> and <strong>Album Artist</strong> to enable
          identification.
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
      {identifyOpen && (
        <ItemsIdentifyModal
          itemIds={folder.files.map((f) => f.id)}
          searchArtist={ed.summary.albumArtist}
          searchAlbum={ed.summary.album}
          onClose={() => setIdentifyOpen(false)}
        />
      )}
    </>
  );
}

export default function Untagged({ dir, dataVersion = 0 }) {
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
  }, [load, dataVersion]);

  const folders = useMemo(
    () => groupUntagged(untaggedItems || []),
    [untaggedItems]
  );
  const folder =
    dir != null ? (folders.find((f) => f.dir === dir) ?? null) : null;

  if (fetchError) {
    return (
      <div className="page page-untagged">
        <div className="crumbs">
          <RouteLink target={{ name: 'library' }} className="crumb">
            <Icon name="arrow-left" size={12} /> Library
          </RouteLink>
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
          <RouteLink target={{ name: 'library' }} className="crumb">
            <Icon name="arrow-left" size={12} /> Library
          </RouteLink>
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
          <RouteLink target={{ name: 'untagged' }} className="crumb">
            <Icon name="arrow-left" size={12} /> Untagged
          </RouteLink>
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
        <RouteLink target={{ name: 'library' }} className="crumb">
          <Icon name="arrow-left" size={12} /> Library
        </RouteLink>
        <span className="crumb-sep">/</span>
        <RouteLink target={{ name: 'untagged' }} className="crumb">
          Untagged
        </RouteLink>
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
