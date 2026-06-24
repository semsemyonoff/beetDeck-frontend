import { useState } from 'react';
import Icon from './Icon.jsx';
import RouteLink from './RouteLink.jsx';

function UntaggedFolderRow({ folder }) {
  return (
    <RouteLink
      className="unt-folder"
      target={{ name: 'untagged', dir: folder.dir }}
    >
      <span className="unt-folder-glyph">
        <Icon name="disc" size={14} />
      </span>
      <span className="unt-folder-text">
        <span className="unt-folder-name">{folder.name}</span>
        <span className="unt-folder-path mono">{folder.root}/</span>
      </span>
      <span className="unt-folder-meta">
        <span className="unt-folder-pill">
          <Icon name="tag" size={10} /> needs tags
        </span>
        <span className="unt-folder-count mono">{folder.files.length}</span>
        <span className="unt-folder-chevron">
          <Icon name="chevron" size={13} />
        </span>
      </span>
    </RouteLink>
  );
}

export default function UntaggedGroup({ folders, wall }) {
  const [open, setOpen] = useState(true);
  const fileCount = (folders || []).reduce((a, f) => a + f.files.length, 0);
  if (!folders || !folders.length) return null;

  return (
    <section
      className={
        'lib-group unt-banner-group' + (wall ? ' unt-banner-wall' : '')
      }
    >
      {wall ? null : (
        <h3 className="lib-group-letter unt-banner-letter">
          <Icon name="alert" size={13} />
        </h3>
      )}
      <div className="unt-banner">
        <button className="unt-banner-bar" onClick={() => setOpen((o) => !o)}>
          <span className="unt-banner-icon">
            <Icon name="alert" size={18} />
          </span>
          <span className="unt-banner-text">
            <span className="unt-banner-title">
              {folders.length} folders need tagging
            </span>
            <span className="unt-banner-sub">
              {fileCount} loose files grouped by directory
            </span>
          </span>
          <span
            className={
              'unt-banner-toggle' + (open ? ' unt-banner-toggle-open' : '')
            }
          >
            {open ? 'Hide' : 'Review'} <Icon name="chevron" size={13} />
          </span>
        </button>
        {open ? (
          <div className="unt-banner-rows">
            {folders.map((f) => (
              <UntaggedFolderRow key={f.dir} folder={f} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
