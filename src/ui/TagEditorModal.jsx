import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { useTagRows } from './useTagRows.js';
import TagTable from './TagTable.jsx';
import BulkBar from './BulkBar.jsx';
import FolderTree from './FolderTree.jsx';
import { basename, dirname } from '../lib/tagEditor.js';

function synthFile(t) {
  const num = t.track ? String(t.track).padStart(2, '0') : '??';
  const title = (t.title || 'untitled').replace(/[/\\?%*:|"<>]/g, '_');
  const ext = t.format ? '.' + t.format.toLowerCase() : '';
  return `${num} - ${title}${ext}`;
}

function seedRow(t, albumData) {
  return {
    id: t.id,
    file: synthFile(t),
    hint: synthFile(t),
    track: t.track != null ? String(t.track) : '',
    title: t.title || '',
    artist: t.artist || '',
    album: albumData.album || '',
    albumartist: albumData.albumartist || '',
    year: albumData.year != null ? String(albumData.year) : '',
    genre: albumData.genre || '',
  };
}

export default function TagEditorModal({
  album,
  focusTrack,
  onClose,
  onSaved,
}) {
  useModalDismiss(onClose);
  const tracks = album.tracks || [];
  const ed = useTagRows(tracks.map((t) => seedRow(t, album)));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const flashTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const showFlash = (kind, text) => {
    setFlash({ kind, text });
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 2400);
  };

  const handleWrite = async () => {
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
      }
      // The album row was written to the DB even on a partial (file-write)
      // failure, so the parent still refreshes — but it is handed the warnings
      // so it does not report an unqualified success.
      if (onSaved) onSaved({ warnings });
    } catch (e) {
      showFlash('err', String(e));
    } finally {
      setSaving(false);
    }
  };

  const albumPath = album.path || '';
  const folderRoot = dirname(albumPath);
  const folderName = basename(albumPath);
  const folderFiles = tracks.map((t) => ({ file: synthFile(t) }));
  const focusTitle =
    focusTrack != null
      ? tracks.find((t) => t.id === focusTrack)?.title || null
      : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-tagedit" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">
              <Icon name="tag" size={12} /> Edit tags
            </div>
            <h3 className="modal-title">
              {album.album || 'Unknown Album'}
              {album.albumartist ? (
                <span className="muted"> — {album.albumartist}</span>
              ) : null}
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="modal-body">
          {flash && (
            <div className={`flash flash-${flash.kind}`}>{flash.text}</div>
          )}
          {focusTitle && (
            <div className="muted small tagedit-focus-note">
              Opened from: {focusTitle}
            </div>
          )}
          <FolderTree
            root={folderRoot}
            folder={folderName}
            files={folderFiles}
            compact
          />
          <TagTable ed={ed} />
          {ed.selected.size > 0 && (
            <BulkBar
              count={ed.selected.size}
              onApply={(vals) => ed.applyBulk(vals)}
              onClear={() => ed.clearSel()}
            />
          )}
        </div>

        <div className="modal-foot">
          <div className="row-end">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || ed.dirtyCount === 0}
              onClick={handleWrite}
            >
              <Icon name="check" size={12} />{' '}
              {saving
                ? 'Writing…'
                : `Write${ed.dirtyCount > 0 ? ` (${ed.dirtyCount})` : ''} tags`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
