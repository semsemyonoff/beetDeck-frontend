import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTagRows } from './useTagRows.js';
import TagTable from './TagTable.jsx';

const ROWS = [
  {
    id: 1,
    title: 'Track One',
    artist: 'Art A',
    album: 'Alb',
    albumartist: '',
    year: '2020',
    genre: '',
    track: '1',
    file: '01.mp3',
    hint: '1',
  },
  {
    id: 2,
    title: 'Track Two',
    artist: 'Art B',
    album: 'Alb',
    albumartist: '',
    year: '2020',
    genre: '',
    track: '2',
    file: '02.mp3',
    hint: '2',
  },
];

function Host({ rows = ROWS, showFile = false }) {
  const ed = useTagRows(rows);
  return <TagTable ed={ed} showFile={showFile} />;
}

describe('TagTable', () => {
  it('renders a checkbox and editable inputs for each row', () => {
    render(<Host />);
    // 1 header checkbox + 2 row checkboxes
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByDisplayValue('Track One')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Track Two')).toBeInTheDocument();
  });

  it('showFile=false hides file spans', () => {
    render(<Host showFile={false} />);
    expect(screen.queryByTitle('01.mp3')).not.toBeInTheDocument();
  });

  it('showFile=true renders file names in title column', () => {
    render(<Host showFile={true} />);
    expect(screen.getByTitle('01.mp3')).toBeInTheDocument();
    expect(screen.getByTitle('02.mp3')).toBeInTheDocument();
  });

  it('editing a title input marks the cell dirty', () => {
    render(<Host />);
    const input = screen.getByDisplayValue('Track One');
    fireEvent.change(input, { target: { value: 'Edited' } });
    expect(screen.getByDisplayValue('Edited')).toBeInTheDocument();
    expect(screen.getAllByTitle('unsaved change').length).toBeGreaterThan(0);
  });

  it('checking a row checkbox applies tte-row-sel class', () => {
    const { container } = render(<Host />);
    const checkboxes = screen.getAllByRole('checkbox');
    // index 0 = header, 1 = row 0, 2 = row 1
    fireEvent.click(checkboxes[1]);
    expect(container.querySelectorAll('.tte-row-sel')).toHaveLength(1);
  });

  it('header checkbox selects all rows', () => {
    const { container } = render(<Host />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(container.querySelectorAll('.tte-row-sel')).toHaveLength(2);
  });

  it('header checkbox deselects all when all are already selected', () => {
    const { container } = render(<Host />);
    const header = screen.getAllByRole('checkbox')[0];
    fireEvent.click(header); // select all
    expect(container.querySelectorAll('.tte-row-sel')).toHaveLength(2);
    fireEvent.click(header); // deselect all
    expect(container.querySelectorAll('.tte-row-sel')).toHaveLength(0);
  });
});
