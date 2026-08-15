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

// The listing carries no count before it arrives, so the skeleton is a fixed
// plausible grid rather than a promise about how many scans exist.
const SKELETON_TILES = 8;

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

function ArtSkeleton() {
  return (
    <div className="art-tile art-tile-skel" aria-hidden="true">
      <div className="art-stage art-skel-stage" />
      <div className="art-meta">
        <div className="art-skel-line" style={{ width: '44%' }} />
        <div
          className="art-skel-line art-skel-line-sm"
          style={{ width: '70%' }}
        />
      </div>
    </div>
  );
}

function ArtLoading() {
  return (
    <>
      <div className="art-count-line mono art-count-skel">
        fetching release images…
      </div>
      <div className="art-grid">
        {Array.from({ length: SKELETON_TILES }, (_, i) => (
          <ArtSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

// `available: false` has two arms — no MusicBrainz id at all, and an id that is
// not a release id — and the title must not state the first about the second.
// The backend's own `reason` is rendered either way rather than paraphrased.
function ArtEmptyNoMbid({ albumId, mbid, reason }) {
  return (
    <div className="art-empty">
      <div className="art-empty-icon">
        <Icon name="tag" size={22} />
      </div>
      <h2 className="art-empty-title">
        {mbid
          ? "This album's MusicBrainz ID is not a release ID"
          : 'This album has no MusicBrainz ID'}
      </h2>
      <p className="art-empty-body">
        Cover Art Archive is indexed by release MBID. Identify the album against
        MusicBrainz first, then its scans show up here.
        {reason ? ` (${reason})` : ''}
      </p>
      <div className="art-empty-actions">
        <RouteLink
          target={{ name: 'album', id: albumId }}
          className="btn btn-primary"
        >
          <Icon name="sparkles" size={13} /> Identify album
        </RouteLink>
      </div>
    </div>
  );
}

function ArtEmptyNoArt({ mbid }) {
  return (
    <div className="art-empty">
      <div className="art-empty-icon">
        <Icon name="grid" size={22} />
      </div>
      <h2 className="art-empty-title">
        Cover Art Archive has no images for this release
      </h2>
      <p className="art-empty-body">
        The release is identified (
        <span className="mono">{mbid ? `${mbid.slice(0, 8)}…` : '—'}</span>) but
        nobody has uploaded scans for it yet. You can contribute them on
        MusicBrainz, or upload a local cover from the album screen.
      </p>
      <div className="art-empty-actions">
        <a
          className="btn btn-primary"
          href={`https://musicbrainz.org/release/${mbid}/cover-art`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="upload" size={13} /> Add art on MusicBrainz
        </a>
      </div>
    </div>
  );
}

// The reason line is the backend's own words plus the status it answered with.
// "CAA could not be reached" is a fact about the network, not about the release,
// and the hint says which of the user's own files this did *not* touch.
function ArtError({ title, error, hint, onRetry }) {
  const parts = [];
  if (error.status) parts.push(`HTTP ${error.status}`);
  if (error.message) parts.push(error.message);
  if (!parts.length) parts.push('request failed');

  return (
    <>
      <div className="art-error">
        <div className="art-error-icon">
          <Icon name="alert" size={16} />
        </div>
        <div className="art-error-text">
          <div className="art-error-title">{title}</div>
          <div className="art-error-reason mono">{parts.join(' · ')}</div>
        </div>
        <button className="btn btn-ghost" onClick={onRetry}>
          <Icon name="refresh" size={13} /> Retry
        </button>
      </div>
      <div className="art-error-hint">{hint}</div>
    </>
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
  // The album request has its own retry counter: a Retry on the listing banner
  // must not re-request metadata that arrived fine, which is the same reason
  // the two fetches are two effects.
  const [albumTick, setAlbumTick] = useState(0);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    let aborted = false;
    setAlbum(null);
    setAlbumError(null);
    fetch(`/api/album/${id}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          const err = new Error(d?.error || '');
          err.status = r.status;
          throw err;
        }
        return d;
      })
      .then((d) => {
        if (!aborted) setAlbum(d);
      })
      .catch((e) => {
        if (!aborted)
          setAlbumError({ status: e.status || 0, message: e.message || '' });
      });
    return () => {
      aborted = true;
    };
  }, [id, dataVersion, albumTick]);

  useEffect(() => {
    let aborted = false;
    setListing(null);
    setListingError(null);
    const url =
      `/api/album/${id}/artwork` + (refreshTick > 0 ? '?refresh=1' : '');
    fetch(url)
      .then(async (r) => {
        // The banner states the reason the backend gave — "CAA could not be
        // reached" and "this release has no art" are different facts and the
        // page must not collapse them into one blank screen.
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          const err = new Error(d?.error || '');
          err.status = r.status;
          throw err;
        }
        return d;
      })
      .then((d) => {
        if (!aborted) setListing(d);
      })
      .catch((e) => {
        if (!aborted)
          setListingError({ status: e.status || 0, message: e.message || '' });
      });
    return () => {
      aborted = true;
    };
  }, [id, dataVersion, refreshTick]);

  const title = albumLabel(album?.album, album?.albumartist);
  useDocumentTitle(title ? `Artwork — ${title}` : 'Artwork');

  // The album request feeds the whole shell, so its failure has no header to
  // hang a banner under — it is the one state that renders on a bare page.
  if (albumError) {
    return (
      <div className="page page-artwork">
        <ArtError
          title="Could not load this album"
          error={albumError}
          hint="Nothing was changed. The album screen may still work — try again, or go back to the library."
          onRetry={() => setAlbumTick((v) => v + 1)}
        />
      </div>
    );
  }
  if (!album) {
    return (
      <div className="page page-artwork">
        <ArtLoading />
      </div>
    );
  }

  const artistName = album.albumartist || '';
  const mbid = listing?.mb_albumid || album.mb_albumid || '';
  const storageOk =
    listing && listing.storage_enabled && !listing.storage_error;
  const provenance = listing ? provenanceLine(listing) : '';

  const images = listing ? sortImages(listing.images) : [];
  const counts = typeCounts(images);
  // A Refresh can drop the type the active chip filters on; falling back to All
  // beats leaving the grid empty with no visible cause.
  const active =
    filter === 'All' || counts.some((c) => c.type === filter) ? filter : 'All';
  const shown = filterByType(images, active);

  // Four outcomes below the header, and they stay four: "no MusicBrainz id",
  // "CAA holds nothing for this release" and "CAA did not answer" are different
  // problems with different next actions, and collapsing any two of them would
  // state something about the library that nobody established.
  let content;
  if (listingError) {
    content = (
      <ArtError
        title="Cover Art Archive did not respond"
        error={listingError}
        hint="The cover already in your files is untouched. Local scans stay available from the album screen."
        onRetry={() => setRefreshTick((v) => v + 1)}
      />
    );
  } else if (!listing) {
    content = <ArtLoading />;
  } else if (!listing.available) {
    content = (
      <ArtEmptyNoMbid albumId={id} mbid={mbid} reason={listing.reason} />
    );
  } else if (!images.length) {
    content = <ArtEmptyNoArt mbid={mbid} />;
  } else {
    content = (
      <>
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
                className={
                  'art-chip' + (active === c.type ? ' art-chip-on' : '')
                }
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
      </>
    );
  }

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
          {/* Storage mode is a property of the listing; there is nothing to
              claim about it until one has arrived. */}
          {listing && (
            <span
              className={'badge ' + (storageOk ? 'badge-ok' : 'badge-warn')}
            >
              <Icon name={storageOk ? 'check' : 'moon'} size={10} />{' '}
              {storageOk
                ? 'Stored locally'
                : listing.storage_error
                  ? 'Storage unavailable'
                  : 'Cache only'}
            </span>
          )}
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
      {listing?.storage_error && (
        <div className="art-error-hint">
          Local storage is configured but unusable: {listing.storage_error}
        </div>
      )}

      {content}
    </div>
  );
}
