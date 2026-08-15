import { useEffect, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import RouteLink from '../ui/RouteLink.jsx';
import { albumLabel } from '../lib/albums.js';
import {
  filterByType,
  pickThumbSize,
  provenanceLine,
  sortImages,
  typeCounts,
} from '../lib/artwork.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

// The grid is `repeat(auto-fill, minmax(190px, 1fr))`, so 190 is the box a tile
// is guaranteed to be at least as wide as. `pickThumbSize` turns it into the
// smallest rendition that covers it — asking for the largest instead is what
// puts 40 originals through the proxy on one gallery open.
const TILE_PX = 190;

function ArtTile({ albumId, image, isCover }) {
  const size = pickThumbSize(image, TILE_PX);
  const types = image.types || [];
  // Measured dimensions are the **original's** and are null until that file has
  // actually been fetched. The 250 px tile in front of you was measured too, but
  // reporting its size here would state a false fact about the scan.
  const measured = image.width && image.height;

  return (
    <button
      type="button"
      className={'art-tile' + (isCover ? ' art-tile-cover' : '')}
    >
      <div className="art-stage">
        <img
          className="art-svg"
          loading="lazy"
          src={`/api/album/${albumId}/artwork/${image.image_id}?size=${size}`}
          alt={types.length ? `${types.join(', ')} artwork` : 'Untyped artwork'}
        />
        {isCover && (
          <span className="art-flag art-flag-cover">
            <Icon name="check" size={10} /> Current cover
          </span>
        )}
        {!image.approved && (
          <span className="art-flag art-flag-unapproved">
            <Icon name="alert" size={10} /> Not approved
          </span>
        )}
        <span className="art-ratio mono">
          {measured ? `${image.width}×${image.height}` : '—'}
        </span>
      </div>
      <div className="art-meta">
        <div className="art-types">
          {types.map((t) => (
            <span
              key={t}
              className={
                'art-type art-type-' + t.replace(/\W/g, '').toLowerCase()
              }
            >
              {t}
            </span>
          ))}
        </div>
        {image.comment && <div className="art-comment">{image.comment}</div>}
      </div>
    </button>
  );
}

export default function Artwork({ id, dataVersion = 0 }) {
  const [album, setAlbum] = useState(null);
  const [albumError, setAlbumError] = useState(null);
  const [listing, setListing] = useState(null);
  const [listingError, setListingError] = useState(null);
  // 0 is the mount load; every later value is a user-driven Refresh, which is
  // the only thing that may spend the CAA courtesy budget with `?refresh=1`.
  const [refreshTick, setRefreshTick] = useState(0);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    let aborted = false;
    setAlbum(null);
    setAlbumError(null);
    fetch(`/api/album/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => {
        if (!aborted) setAlbum(d);
      })
      .catch((e) => {
        if (!aborted) setAlbumError(String(e));
      });
    return () => {
      aborted = true;
    };
  }, [id, dataVersion]);

  useEffect(() => {
    let aborted = false;
    setListing(null);
    setListingError(null);
    const url =
      `/api/album/${id}/artwork` + (refreshTick > 0 ? '?refresh=1' : '');
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => {
        if (!aborted) setListing(d);
      })
      .catch((e) => {
        if (!aborted) setListingError(String(e));
      });
    return () => {
      aborted = true;
    };
  }, [id, dataVersion, refreshTick]);

  const title = albumLabel(album?.album, album?.albumartist);
  useDocumentTitle(title ? `Artwork — ${title}` : 'Artwork');

  const error = albumError || listingError;
  if (error) {
    return (
      <div className="page page-artwork">
        <div className="error">Failed to load artwork: {error}</div>
      </div>
    );
  }
  if (!album || !listing) {
    return (
      <div className="page page-artwork">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  const artistName = album.albumartist || '';
  const mbid = listing.mb_albumid || album.mb_albumid || '';
  const storageOk = listing.storage_enabled && !listing.storage_error;
  const provenance = provenanceLine(listing);

  const images = sortImages(listing.images);
  const counts = typeCounts(images);
  // A Refresh can drop the type the active chip filters on; falling back to All
  // beats leaving the grid empty with no visible cause.
  const active =
    filter === 'All' || counts.some((c) => c.type === filter) ? filter : 'All';
  const shown = filterByType(images, active);

  return (
    <div className="page page-artwork">
      <div className="crumbs">
        <RouteLink target={{ name: 'library' }} className="crumb">
          <Icon name="arrow-left" size={12} /> Library
        </RouteLink>
        {artistName && (
          <>
            <span className="crumb-sep">/</span>
            <RouteLink
              target={{ name: 'artist', artist: artistName }}
              className="crumb"
            >
              {artistName}
            </RouteLink>
          </>
        )}
        <span className="crumb-sep">/</span>
        <RouteLink target={{ name: 'album', id }} className="crumb">
          {album.album || 'Album'}
        </RouteLink>
        <span className="crumb-sep">/</span>
        <span className="crumb crumb-static-now">Artwork</span>
      </div>

      <header className="art-head">
        <div className="art-head-main">
          <div className="modal-eyebrow">
            <Icon name="grid" size={11} /> Cover Art Archive
          </div>
          <h1 className="page-title">Artwork</h1>
          <div className="page-sub">
            <strong>{artistName}</strong>
            {album.album ? ` — ${album.album}` : ''}
            {album.year ? ` (${album.year})` : ''}
            {mbid && (
              <>
                <span className="dot">·</span>
                <span className="mono art-mbid" title={mbid}>
                  {mbid.slice(0, 8)}…
                </span>
              </>
            )}
          </div>
          {provenance && (
            <div className="art-count-line mono">{provenance}</div>
          )}
        </div>
        <div className="art-head-side">
          <span className={'badge ' + (storageOk ? 'badge-ok' : 'badge-warn')}>
            <Icon name={storageOk ? 'check' : 'moon'} size={10} />{' '}
            {storageOk
              ? 'Stored locally'
              : listing.storage_error
                ? 'Storage unavailable'
                : 'Cache only'}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setRefreshTick((v) => v + 1)}
          >
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* A configured-but-unusable storage root is a misconfiguration the
          gallery still works around; say what broke instead of only badging it. */}
      {listing.storage_error && (
        <div className="art-error-hint">
          Local storage is configured but unusable: {listing.storage_error}
        </div>
      )}

      <div className="art-toolbar">
        <div className="art-chips">
          <button
            type="button"
            className={'art-chip' + (active === 'All' ? ' art-chip-on' : '')}
            onClick={() => setFilter('All')}
          >
            All <span className="art-chip-n mono">{images.length}</span>
          </button>
          {counts.map((c) => (
            <button
              key={c.type}
              type="button"
              className={'art-chip' + (active === c.type ? ' art-chip-on' : '')}
              onClick={() => setFilter(c.type)}
            >
              {c.type} <span className="art-chip-n mono">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="art-count-line mono">
          {images.length} images from Cover Art Archive
          {active !== 'All' && (
            <>
              {' '}
              · showing {shown.length} {active.toLowerCase()}
            </>
          )}
        </div>
      </div>

      <div className="art-grid">
        {shown.map((image) => (
          <ArtTile
            key={image.image_id}
            albumId={id}
            image={image}
            isCover={image.image_id === listing.current_image_id}
          />
        ))}
      </div>
    </div>
  );
}
