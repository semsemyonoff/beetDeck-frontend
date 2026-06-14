import { useEffect, useRef, useState } from 'react';
import Topbar from './ui/Topbar.jsx';
import Library from './pages/Library.jsx';
import Artist from './pages/Artist.jsx';
import Album from './pages/Album.jsx';
import Untagged from './pages/Untagged.jsx';
import { useHashRoute, navigate } from './useHashRoute.js';
import { buildScanSummary } from './lib/scan.js';

export default function App() {
  const route = useHashRoute();
  const [scanStatus, setScanStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [scanSummary, setScanSummary] = useState(null); // { added, removed } | null
  const [dataVersion, setDataVersion] = useState(0); // bumped when a scan changes the library
  const scanPollRef = useRef(null);

  const startScanPolling = () => {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    scanPollRef.current = setInterval(async () => {
      try {
        const resp = await fetch('/api/rescan/status');
        if (!resp.ok) return;
        const d = await resp.json();
        if (d.status === 'done' || d.status === 'idle') {
          clearInterval(scanPollRef.current);
          if (d.returncode !== undefined && d.returncode !== 0) {
            setScanStatus('error');
            setScanSummary(null);
          } else {
            const summary = buildScanSummary(d);
            setScanStatus('done');
            setScanSummary(summary);
            // Refresh the current page's data in place when the scan actually
            // changed the library, so new/removed albums show without a reload.
            if (summary && summary.added + summary.removed > 0) {
              setDataVersion((v) => v + 1);
            }
          }
          setTimeout(() => {
            setScanStatus(null);
            setScanSummary(null);
          }, 3000);
        }
      } catch {
        clearInterval(scanPollRef.current);
        setScanStatus('error');
        setTimeout(() => setScanStatus(null), 3000);
      }
    }, 1500);
  };

  const handleScanStart = ({ ok, data }) => {
    if (!ok) {
      if (data?.status === 'running') {
        setScanStatus('running');
        startScanPolling();
      } else {
        setScanStatus('error');
        setTimeout(() => setScanStatus(null), 3000);
      }
      return;
    }
    setScanStatus('running');
    startScanPolling();
  };

  useEffect(() => () => clearInterval(scanPollRef.current), []);

  return (
    <div className="app">
      <Topbar
        onNavHome={() => navigate({ name: 'library' })}
        onScanStart={handleScanStart}
      />
      {scanStatus && (
        <div className={`scan-banner scan-banner--${scanStatus}`}>
          {scanStatus === 'running' && 'Scanning library…'}
          {scanStatus === 'done' && (
            <>
              Scan complete
              {scanSummary != null
                ? ` · +${scanSummary.added} / −${scanSummary.removed} tracks`
                : ''}
            </>
          )}
          {scanStatus === 'error' && 'Scan failed'}
        </div>
      )}
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
      </main>
    </div>
  );
}
