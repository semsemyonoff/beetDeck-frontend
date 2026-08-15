import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import Icon from './Icon.jsx';
import { useModalDismiss } from '../lib/useModalDismiss.js';
import { pickThumbSize, slideDimensions } from '../lib/artwork.js';

// The stage is the lightbox inner (max 1240) minus the 320 px metadata rail,
// so ~880 CSS px at the widest. `pickThumbSize` turns that into the smallest
// rendition that still covers it — the same rule the grid uses at 190.
const STAGE_PX = 900;

const DASH = '—';

/** One alt string for both layers, so a slide reads the same in fullscreen. */
function altFor(types) {
  return types?.length ? `${types.join(', ')} artwork` : 'Untyped artwork';
}

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
 * picked and land on a tile that is not on screen. PhotoSwipe's `dataSource` is
 * built from the same list for the same reason.
 *
 * Two layers, one index: this component owns metadata and actions, PhotoSwipe
 * owns pixels and zoom. While PhotoSwipe is up it also owns `Escape` and the
 * arrows — this component's own handlers are suspended, or one press would
 * collapse both layers and one arrow would advance two frames.
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

  const [fullscreen, setFullscreen] = useState(false);
  const pswpRef = useRef(null);
  // Natural sizes of the renditions this component has actually staged, keyed
  // by image id. The API reports the original's size only once that file has
  // been stored, so for everything else this ratio is all PhotoSwipe gets.
  const naturalRef = useRef({});
  // The PhotoSwipe instance outlives any single render, so its `change`
  // handler reads the callback through a ref rather than closing over the one
  // that existed at construction time.
  const onIndexRef = useRef(onIndex);
  useEffect(() => {
    onIndexRef.current = onIndex;
  }, [onIndex]);

  // Passing `null` unbinds the hook: while PhotoSwipe is open, Escape is its.
  useModalDismiss(fullscreen ? null : onClose);

  const prev = useCallback(() => {
    if (count) onIndex((index - 1 + count) % count);
  }, [count, index, onIndex]);
  const next = useCallback(() => {
    if (count) onIndex((index + 1) % count);
  }, [count, index, onIndex]);

  // Escape is `useModalDismiss`'s; the arrows are this component's own. Both sit
  // on `document` so they agree about which listener runs first.
  useEffect(() => {
    if (fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next, fullscreen]);

  // One instance for the component's lifetime. `pswpModule` is a dynamic import
  // so the ~40 kB core lands in its own chunk that only this route pays for,
  // and it is only fetched when someone actually goes fullscreen.
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      // PhotoSwipe defaults to 0.8, which assumes the layer behind it is a
      // page grid worth glimpsing. Here it is this component's own overlay —
      // metadata rail, actions and all — and at 0.8 it reads straight through
      // the fullscreen image. Verified in the browser, not reasoned about.
      bgOpacity: 1,
    });
    // A slide's `width`/`height` are a declaration, and PhotoSwipe derives its
    // zoom ceiling from them. Until the backend has measured an original,
    // `slideDimensions` can only offer the thumbnail's ratio scaled to
    // `RATIO_LONG_EDGE`, and on a wide viewport that ceiling lands *below* the
    // fit zoom: `canZoom` goes false, and a click closes the viewer instead of
    // zooming into the one layer that exists to show the original's detail.
    // The loaded <img> knows the real size, so correct the slide from it and let
    // PhotoSwipe recompute its levels. Measured slides no-op on the equality
    // check, and the second visit gets the size from the API anyway.
    lightbox.on('loadComplete', ({ slide, content }) => {
      const el = content?.element;
      const width = el?.naturalWidth;
      const height = el?.naturalHeight;
      if (!slide || !width || !height) return;
      if (slide.width === width && slide.height === height) return;
      content.width = width;
      content.height = height;
      if (slide.data) {
        slide.data.width = width;
        slide.data.height = height;
      }
      slide.width = width;
      slide.height = height;
      // Recomputes the zoom levels from the corrected size and re-applies the
      // current one — the same call PhotoSwipe makes on a viewport resize.
      slide.resize?.();
    });
    lightbox.on('change', () => {
      const i = lightbox.pswp?.currIndex;
      // Write the fullscreen index back into page state, so closing lands on
      // the frame fullscreen ended on rather than the one it started from.
      if (typeof i === 'number') onIndexRef.current?.(i);
    });
    lightbox.on('close', () => setFullscreen(false));
    lightbox.init();
    pswpRef.current = lightbox;
    return () => {
      pswpRef.current = null;
      lightbox.destroy();
    };
  }, []);

  const rememberNatural = useCallback((e) => {
    const el = e.currentTarget;
    const id = el?.dataset?.imageId;
    if (id && el.naturalWidth > 0 && el.naturalHeight > 0) {
      naturalRef.current[id] = {
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
      };
    }
  }, []);

  const openFullscreen = useCallback(() => {
    const lightbox = pswpRef.current;
    if (!lightbox || !count) return;
    const dataSource = images.map((a) => {
      const dims = slideDimensions(a, naturalRef.current[a.image_id]);
      return {
        src: `/api/album/${albumId}/artwork/${a.image_id}?size=full`,
        // Already in the browser cache from the grid, so the placeholder is
        // instant and the transition does not start on an empty frame.
        msrc: `/api/album/${albumId}/artwork/${a.image_id}?size=250`,
        alt: altFor(a.types),
        ...(dims || {}),
      };
    });
    if (lightbox.loadAndOpen(index, dataSource)) setFullscreen(true);
  }, [albumId, count, images, index]);

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
            {/* Clicking the staged image hands the pixels to PhotoSwipe. The
                <img> is the target rather than a wrapping <button> because the
                frame's layout rules are what letterbox an extreme ratio. */}
            <img
              className="art-svg"
              src={`/api/album/${albumId}/artwork/${image.image_id}?size=${size}`}
              alt={altFor(types)}
              data-image-id={image.image_id}
              onLoad={rememberNatural}
              onClick={openFullscreen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openFullscreen();
                }
              }}
              role="button"
              tabIndex={0}
              title="Open fullscreen"
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
