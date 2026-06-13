import { useState } from 'react';
import Icon from './Icon.jsx';

const BULK_EMPTY = {
  album: '',
  albumartist: '',
  artist: '',
  year: '',
  genre: '',
};

const FIELDS = [
  { k: 'album', label: 'Album' },
  { k: 'albumartist', label: 'Album Artist' },
  { k: 'artist', label: 'Artist' },
  { k: 'year', label: 'Year', mono: true, narrow: true },
  { k: 'genre', label: 'Genre' },
];

export default function BulkBar({ count, onApply, onClear }) {
  const [v, setV] = useState(BULK_EMPTY);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const any = Object.values(v).some((x) => String(x).trim() !== '');

  return (
    <div className="tte-bulk">
      <div className="tte-bulk-head">
        <span className="tte-bulk-count">{count} selected</span>
        <span className="tte-bulk-hint muted small">
          Set album-level values once, then push them onto every selected track.
        </span>
        <button className="track-mini-btn" onClick={onClear}>
          Deselect
        </button>
      </div>
      <div className="tte-bulk-fields">
        {FIELDS.map((f) => (
          <label
            key={f.k}
            className={
              'tte-bulk-field' + (f.narrow ? ' tte-bulk-field-narrow' : '')
            }
          >
            <span className="tte-bulk-label">{f.label}</span>
            <input
              className={'tte-bulk-input' + (f.mono ? ' mono' : '')}
              value={v[f.k]}
              placeholder="leave as-is"
              onChange={(e) => set(f.k, e.target.value)}
            />
          </label>
        ))}
        <button
          className="btn btn-primary tte-bulk-apply"
          disabled={!any}
          onClick={() => {
            onApply(v);
            setV(BULK_EMPTY);
          }}
        >
          <Icon name="check" size={13} /> Apply to {count}
        </button>
      </div>
    </div>
  );
}
