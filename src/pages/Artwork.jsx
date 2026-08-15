import { useEffect, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import RouteLink from '../ui/RouteLink.jsx';
import { albumLabel } from '../lib/albums.js';
import { provenanceLine } from '../lib/artwork.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function Artwork({ id, dataVersion = 0 }) {
  const [album, setAlbum] = useState(null);
  const [albumError, setAlbumError] = useState(null);
  const [listing, setListing] = useState(null);
  const [listingError, setListingError] = useState(null);
  // 0 is the mount load; every later value is a user-driven Refresh, which is
  // the only thing that may spend the CAA courtesy budget with `?refresh=1`.
  const [refreshTick, setRefreshTick] = useState(0);

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
    </div>
  );
}
