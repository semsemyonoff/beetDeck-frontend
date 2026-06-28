import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScanBanner from './ScanBanner.jsx';
import { buildScanViewModel } from '../lib/scan.js';

// Helpers that build typed view models for each state.
function makeVm(phase, extra = {}) {
  return buildScanViewModel({
    phase,
    processed: extra.processed ?? 3,
    total: extra.total ?? 10,
    current_item: extra.current_item ?? null,
    run_id: 'test-run',
    added: extra.added ?? [],
    removed: extra.removed ?? [],
    ...extra,
  });
}

describe('ScanBanner — view-model selection', () => {
  it('renders nothing when scan is null (off state)', () => {
    const { container } = render(<ScanBanner scan={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when scan.state is "off"', () => {
    const { container } = render(
      <ScanBanner scan={{ state: 'off' }} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders determinate progress bar for running-full scan', () => {
    const vm = makeVm('importing', { processed: 4, total: 10 });
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.getByText('importing')).toBeInTheDocument();
    expect(screen.getByText('4/10')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(
      document.querySelector('.scan-progress:not(.scan-progress-indet)')
    ).toBeTruthy();
  });

  it('renders indeterminate bar and "processed N done" for running-quick scan', () => {
    const vm = makeVm('importing', { total: null, processed: 5 });
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.getByText(/Processing/)).toBeInTheDocument();
    expect(screen.getByText(/5 done/)).toBeInTheDocument();
    expect(document.querySelector('.scan-progress-indet')).toBeTruthy();
  });

  it('renders done message with track counts', () => {
    const vm = makeVm('done', {
      added: [{ id: 1 }, { id: 2 }],
      removed: [{ id: 3 }],
    });
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.getByText(/Scan complete/)).toBeInTheDocument();
    expect(screen.getByText(/\+2 \/ −1/)).toBeInTheDocument();
  });

  it('renders error message', () => {
    const vm = makeVm('error');
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.getByText(/Scan failed/)).toBeInTheDocument();
    expect(screen.getByText(/see log/)).toBeInTheDocument();
  });

  it('shows current item when provided (running)', () => {
    const vm = makeVm('importing', { current_item: '/music/Artist/Album' });
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.getByText('/music/Artist/Album')).toBeInTheDocument();
  });
});

describe('ScanBanner — dismiss flow', () => {
  it('dismiss button is NOT shown while running', () => {
    const vm = makeVm('importing');
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /dismiss scan/i })).toBeNull();
  });

  it('dismiss button IS shown when done', () => {
    const vm = makeVm('done');
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /dismiss scan/i })
    ).toBeInTheDocument();
  });

  it('dismiss button IS shown when error', () => {
    const vm = makeVm('error');
    render(<ScanBanner scan={vm} onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /dismiss scan/i })
    ).toBeInTheDocument();
  });

  it('clicking × calls onClose', () => {
    const onClose = vi.fn();
    const vm = makeVm('done');
    render(<ScanBanner scan={vm} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss scan/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Details link is always present', () => {
    const runningVm = makeVm('importing');
    const { rerender } = render(
      <ScanBanner scan={runningVm} onClose={vi.fn()} />
    );
    expect(screen.getByRole('link', { name: /details/i })).toBeInTheDocument();

    const doneVm = makeVm('done');
    rerender(<ScanBanner scan={doneVm} onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: /details/i })).toBeInTheDocument();
  });
});
