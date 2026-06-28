import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

// Build a fetch stub that dispatches by URL substring. Returns a sensible
// default for any unmatched request so child pages (Library, version) render
// without crashing.
function stubFetch(routes) {
  return vi.fn((url) => {
    for (const [pattern, value] of routes) {
      if (url.includes(pattern)) {
        const { status = 200, body = {} } = value;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        });
      }
    }
    // Library uses a 503 sentinel to mean "not initialized" — safe default.
    return Promise.resolve({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
  });
}

const DONE_STATUS = {
  status: 'done',
  phase: 'done',
  processed: 5,
  total: 5,
  current_item: null,
  run_id: 'r1',
  added: [{ id: 1 }, { id: 2 }],
  removed: [],
};

describe('App — scan recovery on mount', () => {
  beforeEach(() => {
    window.location.hash = '';
    // jsdom has no matchMedia; Topbar's theme resolver needs it.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recovers a finished-but-undismissed scan from the backend and shows the banner', async () => {
    const fetchMock = stubFetch([
      ['/api/rescan/status', { body: DONE_STATUS }],
      ['/api/version', { body: { beetdeck: '0.2.0', beets: '2.12.0' } }],
      ['/api/library', { status: 503 }],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText(/Scan complete/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/rescan/status');
  });

  it('shows no banner when the persisted status is idle', async () => {
    const fetchMock = stubFetch([
      [
        '/api/rescan/status',
        { body: { status: 'idle', phase: 'idle', processed: 0, total: null } },
      ],
      ['/api/version', { body: { beetdeck: '0.2.0', beets: '2.12.0' } }],
      ['/api/library', { status: 503 }],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/rescan/status')
    );
    expect(screen.queryByText(/Scan complete/)).toBeNull();
  });
});
