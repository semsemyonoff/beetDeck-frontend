import { useCallback, useEffect, useRef, useState } from 'react';
import Topbar from './ui/Topbar.jsx';
import ScanBanner from './ui/ScanBanner.jsx';
import Library from './pages/Library.jsx';
import Artist from './pages/Artist.jsx';
import Album from './pages/Album.jsx';
import Untagged from './pages/Untagged.jsx';
import ScanLog from './pages/ScanLog.jsx';
import { useHashRoute } from './useHashRoute.js';
import { buildScanViewModel } from './lib/scan.js';

export default function App() {
  const route = useHashRoute();
  const [scanViewModel, setScanViewModel] = useState(null);
  const [dataVersion, setDataVersion] = useState(0); // bumped when a scan changes the library
  const [version, setVersion] = useState(null); // { beetdeck, beets } | null
  const scanPollRef = useRef(null);

  const startScanPolling = useCallback(() => {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    scanPollRef.current = setInterval(async () => {
      try {
        const resp = await fetch('/api/rescan/status');
        if (!resp.ok) return;
        const d = await resp.json();
        const vm = buildScanViewModel(d);
        setScanViewModel(vm);
        if (d.phase === 'done') {
          clearInterval(scanPollRef.current);
          // Refresh the current page's data in place when the scan actually
          // changed the library, so new/removed albums show without a reload.
          if (vm && vm.added + vm.removed > 0) {
            setDataVersion((v) => v + 1);
          }
        } else if (d.phase === 'error') {
          clearInterval(scanPollRef.current);
        } else if (!vm) {
          // idle or unrecognised — nothing to show
          clearInterval(scanPollRef.current);
        }
      } catch {
        clearInterval(scanPollRef.current);
      }
    }, 1500);
  }, []);

  const handleScanStart = ({ ok, data, mode }) => {
    // Show an optimistic "running" banner the instant the button is clicked,
    // before the first /status poll returns (which is up to one interval away).
    // total is unknown until that first poll, so the bar starts indeterminate.
    const startingVm = {
      state: 'running',
      phase: mode === 'full' ? 'importing' : 'updating',
      mode: mode === 'full' ? 'full' : 'quick',
      processed: 0,
      total: null,
      currentItem: null,
      runId: null,
      added: 0,
      removed: 0,
    };
    if (!ok) {
      if (data?.status === 'running' || data?.phase === 'importing') {
        setScanViewModel(startingVm);
        startScanPolling();
      } else {
        setScanViewModel({
          state: 'error',
          phase: 'error',
          mode: 'quick',
          processed: 0,
          total: null,
          currentItem: null,
          runId: null,
          added: 0,
          removed: 0,
        });
      }
      return;
    }
    setScanViewModel(startingVm);
    startScanPolling();
  };

  const handleDismiss = async () => {
    try {
      await fetch('/api/rescan/dismiss', { method: 'POST' });
    } catch {
      // best effort
    }
    setScanViewModel(null);
  };

  useEffect(() => () => clearInterval(scanPollRef.current), []);

  useEffect(() => {
    // On load, recover an in-flight or finished-but-undismissed scan from the
    // backend (which persists the result until dismissed) so the banner and the
    // scan-log screen survive a page reload / direct navigation to #/scan.
    let cancelled = false;
    fetch('/api/rescan/status')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (cancelled || !d) return;
        const vm = buildScanViewModel(d);
        if (!vm) return;
        setScanViewModel(vm);
        if (d.phase === 'importing' || d.phase === 'updating') {
          startScanPolling();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [startScanPolling]);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((v) => {
        if (v) setVersion(v);
      });
  }, []);

  return (
    <div className="app">
      <Topbar onScanStart={handleScanStart} version={version} />
      <ScanBanner scan={scanViewModel} onClose={handleDismiss} />
      <main className="app-main">
        {route.name === 'library' && <Library dataVersion={dataVersion} />}
        {route.name === 'artist' && (
          <Artist
            key={route.artist}
            name={route.artist}
            dataVersion={dataVersion}
          />
        )}
        {route.name === 'album' && (
          <Album key={route.id} id={route.id} dataVersion={dataVersion} />
        )}
        {route.name === 'untagged' && (
          <Untagged
            key={route.dir || '__index'}
            dir={route.dir}
            dataVersion={dataVersion}
          />
        )}
        {route.name === 'scan' && <ScanLog scan={scanViewModel} />}
      </main>
    </div>
  );
}
