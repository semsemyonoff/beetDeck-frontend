import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTagRows } from './useTagRows.js';

// Tiny host component that exposes all hook operations as data-testid buttons / spans.
function Host({ initialRows }) {
  const ed = useTagRows(initialRows);

  return (
    <div>
      <span data-testid="dirty-count">{ed.dirtyCount}</span>
      <span data-testid="saved">{String(ed.saved)}</span>
      <span data-testid="can-identify">{String(ed.summary.canIdentify)}</span>
      <span data-testid="album-summary">{ed.summary.album}</span>
      <span data-testid="selected-size">{ed.selected.size}</span>
      <span data-testid="all-selected">{String(ed.allSelected)}</span>

      {ed.rows.map((row, i) => (
        <div key={i} data-testid={`row-${i}`}>
          <span data-testid={`row-${i}-title`}>{row.title}</span>
          <span data-testid={`row-${i}-album`}>{row.album}</span>
          <span data-testid={`row-${i}-albumartist`}>{row.albumartist}</span>
          <span data-testid={`row-${i}-dirty-title`}>
            {String(ed.dirty(i, 'title'))}
          </span>
          <button
            data-testid={`row-${i}-edit-title`}
            onClick={() => ed.setField(i, 'title', `edited-${i}`)}
          >
            edit title
          </button>
          <button data-testid={`row-${i}-toggle`} onClick={() => ed.toggle(i)}>
            toggle
          </button>
        </div>
      ))}

      <button
        data-testid="apply-bulk"
        onClick={() =>
          ed.applyBulk({ album: 'BulkAlbum', albumartist: 'BulkAA' })
        }
      >
        apply bulk
      </button>
      <button data-testid="select-all" onClick={() => ed.selectAll()}>
        select all
      </button>
      <button data-testid="clear-sel" onClick={() => ed.clearSel()}>
        clear sel
      </button>
      <button
        data-testid="set-album"
        onClick={() => ed.setField(0, 'album', 'NewAlbum')}
      >
        set album
      </button>
      <button
        data-testid="set-albumartist"
        onClick={() => ed.setField(0, 'albumartist', 'NewAA')}
      >
        set albumartist
      </button>
      <button
        data-testid="sync-row-1"
        onClick={() =>
          ed.syncRow(1, { title: 'SyncedTitle', album: 'SyncedAlbum' })
        }
      >
        sync row 1
      </button>
      <button data-testid="commit" onClick={() => ed.commit()}>
        commit
      </button>
      <button
        data-testid="commit-persist"
        onClick={() =>
          ed.commit(
            (payload) => {
              window.__lastPayload = payload;
              return Promise.resolve();
            },
            {
              album: ed.rows[0]?.album || '',
              albumartist: ed.rows[0]?.albumartist || '',
            }
          )
        }
      >
        commit persist
      </button>
    </div>
  );
}

const ROWS = [
  {
    id: 1,
    title: 'T1',
    artist: 'A',
    album: '',
    albumartist: '',
    year: '',
    genre: '',
    track: '1',
    file: '01.mp3',
  },
  {
    id: 2,
    title: 'T2',
    artist: 'B',
    album: '',
    albumartist: '',
    year: '',
    genre: '',
    track: '2',
    file: '02.mp3',
  },
];

describe('useTagRows', () => {
  it('editing a field marks it dirty and increments dirtyCount', () => {
    render(<Host initialRows={ROWS} />);
    expect(screen.getByTestId('dirty-count').textContent).toBe('0');
    expect(screen.getByTestId('row-0-dirty-title').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('row-0-edit-title'));

    expect(screen.getByTestId('row-0-title').textContent).toBe('edited-0');
    expect(screen.getByTestId('row-0-dirty-title').textContent).toBe('true');
    expect(screen.getByTestId('dirty-count').textContent).toBe('1');
  });

  it('bulk apply mutates only selected rows', () => {
    render(<Host initialRows={ROWS} />);

    fireEvent.click(screen.getByTestId('row-0-toggle'));
    expect(screen.getByTestId('selected-size').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('apply-bulk'));

    expect(screen.getByTestId('row-0-album').textContent).toBe('BulkAlbum');
    expect(screen.getByTestId('row-1-album').textContent).toBe('');
  });

  it('selectAll selects all rows; clearSel empties selection', () => {
    render(<Host initialRows={ROWS} />);

    fireEvent.click(screen.getByTestId('select-all'));
    expect(screen.getByTestId('selected-size').textContent).toBe('2');
    expect(screen.getByTestId('all-selected').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('clear-sel'));
    expect(screen.getByTestId('selected-size').textContent).toBe('0');
    expect(screen.getByTestId('all-selected').textContent).toBe('false');
  });

  it('selectAll when all are selected clears the selection (toggle)', () => {
    render(<Host initialRows={ROWS} />);

    fireEvent.click(screen.getByTestId('select-all'));
    expect(screen.getByTestId('all-selected').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('select-all'));
    expect(screen.getByTestId('selected-size').textContent).toBe('0');
  });

  it('summary.canIdentify is false initially', () => {
    render(<Host initialRows={ROWS} />);
    expect(screen.getByTestId('can-identify').textContent).toBe('false');
  });

  it('summary.canIdentify flips true when album and albumartist are both set', () => {
    render(<Host initialRows={ROWS} />);
    expect(screen.getByTestId('can-identify').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('set-album'));
    expect(screen.getByTestId('can-identify').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('set-albumartist'));
    expect(screen.getByTestId('can-identify').textContent).toBe('true');
    expect(screen.getByTestId('album-summary').textContent).toBe('NewAlbum');
  });

  it('commit without persist resets dirty baseline and sets saved=true', async () => {
    render(<Host initialRows={ROWS} />);

    fireEvent.click(screen.getByTestId('row-0-edit-title'));
    expect(screen.getByTestId('dirty-count').textContent).toBe('1');
    expect(screen.getByTestId('saved').textContent).toBe('false');

    await act(async () => {
      fireEvent.click(screen.getByTestId('commit'));
    });

    expect(screen.getByTestId('dirty-count').textContent).toBe('0');
    expect(screen.getByTestId('saved').textContent).toBe('true');
  });

  it('commit with persist calls persist with batchPayload and clears dirty', async () => {
    render(<Host initialRows={ROWS} />);

    fireEvent.click(screen.getByTestId('set-album'));
    fireEvent.click(screen.getByTestId('set-albumartist'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('commit-persist'));
    });

    expect(window.__lastPayload).toBeDefined();
    expect(window.__lastPayload.items.map((i) => i.id)).toEqual([1, 2]);
    expect(screen.getByTestId('dirty-count').textContent).toBe('0');
    expect(screen.getByTestId('saved').textContent).toBe('true');
  });

  it('syncRow updates the matching row and baseline without marking it dirty', () => {
    render(<Host initialRows={ROWS} />);
    expect(screen.getByTestId('dirty-count').textContent).toBe('0');

    fireEvent.click(screen.getByTestId('sync-row-1'));

    // Row reflects the externally-persisted values…
    expect(screen.getByTestId('row-0-title').textContent).toBe('SyncedTitle');
    expect(screen.getByTestId('row-0-album').textContent).toBe('SyncedAlbum');
    // …but is not considered dirty (baseline moved too), so a later batch
    // write neither re-sends nor reverts these fields.
    expect(screen.getByTestId('row-0-dirty-title').textContent).toBe('false');
    expect(screen.getByTestId('dirty-count').textContent).toBe('0');
  });

  it('setField clears saved flag', async () => {
    render(<Host initialRows={ROWS} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('commit'));
    });
    expect(screen.getByTestId('saved').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('row-0-edit-title'));
    expect(screen.getByTestId('saved').textContent).toBe('false');
  });
});
