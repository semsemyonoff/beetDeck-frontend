import { useCallback, useEffect } from 'react';
import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { pickThumbSize } from '../lib/artwork.js';

// The stage is the lightbox inner (max 1240) minus the 320 px metadata rail,
// so ~880 CSS px at the widest. `pickThumbSize` turns that into the smallest
// rendition that still covers it — the same rule the grid uses at 190.
const STAGE_PX = 900;

const DASH = '—';

/** `<dt>/<dd>` pair; an unknown value is an em dash, never a guess. */
function MetaRow({ label, value, mono = true }) {
  const known = value !== null && value !== undefined && value !== '';
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono && known ? 'mono' : undefined}>
        {known ? value : <span className="muted">{DASH}</span>}
      </dd>
    </div>
  );
}

/**
 * The in-page viewer for one Cover Art Archive scan.
 *
 * **Props-driven, with no network code of its own** — the repository's modal
 * convention. `POST …/artwork/<id>/apply` lives in `pages/Artwork.jsx` and
 * arrives here as `onApply` / `applyBusy` / `applyError`, so the component stays
 * a pure state machine and the page keeps one place where writes happen.
 *
 * `images` is the **filtered** list the grid is showing and `index` points into
 * it: navigation that walked the unfiltered list would leave the chip the user
 * picked and land on a tile that is not on screen.
 */
export default function ArtLightbox({
  albumId,
  images,
  index,
  currentImageId = null,
  onIndex,
  onClose,
  onApply,
  applyBusy = false,
  applyError = null,
}) {
  const count = images?.length || 0;
  const image = count ? images[index] : null;

  useModalDismiss(onClose);

  const prev = useCallback(() => {
    if (count) onIndex((index - 1 + count) % count);
  }, [count, index, onIndex]);
  const next = useCallback(() => {
    if (count) onIndex((index + 1) % count);
  }, [count, index, onIndex]);

  // Escape is `useModalDismiss`'s; the arrows are this component's own. Both sit
  // on `document` so they agree about which listener runs first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next]);

  if (!image) return null;

  const types = image.types || [];
  const size = pickThumbSize(image, STAGE_PX);
  const measured = image.width > 0 && image.height > 0;
  const thumbs = image.thumb_sizes || [];
  const isCover = image.image_id === currentImageId;
  const fullHref = `/api/album/${albumId}/artwork/${image.image_id}?size=full`;

  return (
    <div className="art-lightbox" onClick={onClose}>
      <div
        className="art-lb-inner"
        role="dialog"
        aria-modal="true"
        aria-label="Artwork viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="art-lb-stage">
          <button
            type="button"
            className="art-lb-nav art-lb-prev"
            onClick={prev}
            aria-label="Previous"
          >
            <span
              style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}
            >
              <Icon name="chevron" size={18} />
            </span>
          </button>
          <div className="art-lb-frame">
            <img
              className="art-svg"
              src={`/api/album/${albumId}/artwork/${image.image_id}?size=${size}`}
              alt={
                types.length ? `${types.join(', ')} artwork` : 'Untyped artwork'
              }
            />
          </div>
          <button
            type="button"
            className="art-lb-nav art-lb-next"
            onClick={next}
            aria-label="Next"
          >
            <Icon name="chevron" size={18} />
          </button>
          <div className="art-lb-counter mono">
            {index + 1} / {count}
          </div>
        </div>

        <aside className="art-lb-side">
          <div className="art-lb-side-head">
            <div>
              <div className="modal-eyebrow">
                <Icon name="disc" size={11} /> Cover Art Archive
              </div>
              <div className="art-lb-title">
                {types.length ? types.join(' · ') : 'Untyped'}
              </div>
            </div>
            <button className="btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="x" size={14} />
            </button>
          </div>

          <div className="art-lb-flags">
            {isCover && (
              <span className="badge badge-ok">
                <Icon name="check" size={10} /> current cover
              </span>
            )}
            {image.approved ? (
              <span className="badge badge-ok">approved</span>
            ) : (
              <span className="badge badge-warn">
                <Icon name="alert" size={10} /> not approved
              </span>
            )}
            {image.front && <span className="badge badge-info">front</span>}
            {image.back && <span className="badge badge-info">back</span>}
          </div>

          <dl className="art-lb-meta">
            <MetaRow label="Types" value={types.join(', ')} mono={false} />
            {/* The measured size is the **original's**, and it is null until
                that file has been fetched — an em dash is the honest answer,
                the staged thumbnail's own size would be a false fact. */}
            <MetaRow
              label="Size"
              value={measured ? `${image.width} × ${image.height} px` : null}
            />
            <MetaRow
              label="Ratio"
              value={
                measured ? `${(image.width / image.height).toFixed(2)}:1` : null
              }
            />
            <MetaRow
              label="Thumbnails"
              value={thumbs.length ? `${thumbs.join(' · ')} px` : null}
            />
            <MetaRow label="Image ID" value={image.image_id} />
            <MetaRow label="Comment" value={image.comment} mono={false} />
          </dl>

          {applyError && (
            <div className="error small" role="alert">
              {applyError}
            </div>
          )}

          <div className="art-lb-actions">
            <button
              className="btn btn-primary"
              disabled={isCover || applyBusy}
              onClick={() => onApply(image)}
            >
              {applyBusy ? (
                <span className="btn-spinner" />
              ) : (
                <Icon name="check" size={13} />
              )}{' '}
              {isCover
                ? 'Already album cover'
                : applyBusy
                  ? 'Setting cover…'
                  : 'Set as album cover'}
            </button>
            {image.mb_url && (
              <a
                className="btn btn-ghost"
                href={image.mb_url}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="tag" size={13} /> Open in MusicBrainz
              </a>
            )}
            {/* Through the proxy like every other byte on this page — the
                browser never learns an upstream CAA URL. */}
            <a className="btn btn-ghost" href={fullHref} download>
              <Icon name="download" size={13} /> Download
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
