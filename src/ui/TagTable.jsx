import Icon from './Icon.jsx';

function Cell({ value, ph, onChange, mono, dirty, align }) {
  return (
    <div
      className={
        'tte-cell' +
        (mono ? ' mono' : '') +
        (dirty ? ' tte-cell-dirty' : '') +
        (align ? ' tte-cell-' + align : '')
      }
    >
      <input
        className="tte-input"
        value={value}
        placeholder={ph}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      {dirty ? <span className="tte-dirty-dot" title="unsaved change" /> : null}
    </div>
  );
}

export default function TagTable({ ed, showFile }) {
  const { rows, setField, selected, toggle, allSelected, selectAll, clearSel, dirty } = ed;
  return (
    <div className="tte">
      <div className="tte-row tte-head">
        <label className="tte-chk">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => (allSelected ? clearSel() : selectAll())}
          />
        </label>
        <span className="tte-th tte-col-num">#</span>
        <span className="tte-th">
          Title{showFile ? <span className="tte-th-sub">file</span> : null}
        </span>
        <span className="tte-th">Artist</span>
        <span className="tte-th">Album</span>
        <span className="tte-th tte-col-year">Year</span>
      </div>

      {rows.map((r, i) => {
        const sel = selected.has(i);
        return (
          <div key={i} className={'tte-row' + (sel ? ' tte-row-sel' : '')}>
            <label className="tte-chk">
              <input type="checkbox" checked={sel} onChange={() => toggle(i)} />
            </label>
            <div className="tte-col-num">
              <Cell
                value={r.track}
                ph={/^\d+$/.test(r.hint || '') ? r.hint : '–'}
                mono
                align="center"
                dirty={dirty(i, 'track')}
                onChange={(v) => setField(i, 'track', v)}
              />
            </div>
            <div className="tte-title-cell">
              <Cell
                value={r.title}
                ph={r.hint || 'Untitled'}
                dirty={dirty(i, 'title')}
                onChange={(v) => setField(i, 'title', v)}
              />
              {showFile ? (
                <span className="tte-file mono" title={r.file}>
                  <Icon name="tag" size={10} /> {r.file}
                </span>
              ) : null}
            </div>
            <Cell
              value={r.artist}
              ph="—"
              dirty={dirty(i, 'artist')}
              onChange={(v) => setField(i, 'artist', v)}
            />
            <Cell
              value={r.album}
              ph="—"
              dirty={dirty(i, 'album')}
              onChange={(v) => setField(i, 'album', v)}
            />
            <div className="tte-col-year">
              <Cell
                value={r.year}
                ph="—"
                mono
                align="center"
                dirty={dirty(i, 'year')}
                onChange={(v) => setField(i, 'year', v)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
