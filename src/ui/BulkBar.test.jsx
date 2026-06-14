import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkBar from './BulkBar.jsx';

describe('BulkBar', () => {
  it('renders count and all field labels', () => {
    render(<BulkBar count={3} onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByText('Album')).toBeInTheDocument();
    expect(screen.getByText('Album Artist')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Genre')).toBeInTheDocument();
  });

  it('Apply button is disabled when no fields are filled', () => {
    render(<BulkBar count={2} onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: /apply to 2/i })).toBeDisabled();
  });

  it('Apply button enables when at least one field is filled', () => {
    render(<BulkBar count={2} onApply={vi.fn()} onClear={vi.fn()} />);
    // FIELDS order: album, albumartist, artist, year, genre — index 0 is album
    const inputs = screen.getAllByPlaceholderText('leave as-is');
    fireEvent.change(inputs[0], { target: { value: 'My Album' } });
    expect(
      screen.getByRole('button', { name: /apply to 2/i })
    ).not.toBeDisabled();
  });

  it('Deselect button calls onClear', () => {
    const onClear = vi.fn();
    render(<BulkBar count={1} onApply={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('Apply calls onApply with entered values and resets inputs', () => {
    const onApply = vi.fn();
    render(<BulkBar count={2} onApply={onApply} onClear={vi.fn()} />);
    const inputs = screen.getAllByPlaceholderText('leave as-is');
    // Fill album (0) and albumartist (1)
    fireEvent.change(inputs[0], { target: { value: 'My Album' } });
    fireEvent.change(inputs[1], { target: { value: 'My Artist' } });

    fireEvent.click(screen.getByRole('button', { name: /apply to 2/i }));

    expect(onApply).toHaveBeenCalledWith({
      album: 'My Album',
      albumartist: 'My Artist',
      artist: '',
      year: '',
      genre: '',
    });
    // Inputs reset
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
  });

  it('Apply button shows count in label', () => {
    render(<BulkBar count={5} onApply={vi.fn()} onClear={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /apply to 5/i })
    ).toBeInTheDocument();
  });
});
