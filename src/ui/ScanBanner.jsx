import Icon from './Icon.jsx';
import { hrefFor } from '../lib/route.js';

export default function ScanBanner({ scan, onClose }) {
  if (!scan || scan.state === 'off') return null;

  const { state, mode, phase, processed, total, currentItem, added, removed } =
    scan;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  const running = state === 'running';
  const determinate = running && mode === 'full';

  const toneClass =
    state === 'done'
      ? 'scan-banner-done'
      : state === 'error'
        ? 'scan-banner-error'
        : '';

  let glyph;
  if (running) {
    glyph =
      mode === 'full' ? (
        <span className="scan-spin" aria-hidden="true" />
      ) : (
        <Icon name="zap" size={14} />
      );
  } else if (state === 'done') {
    glyph = <Icon name="check" size={14} />;
  } else {
    glyph = <Icon name="alert" size={14} />;
  }

  return (
    <div
      className={
        'scan-banner' +
        (running ? ' scan-banner-running' : '') +
        (toneClass ? ' ' + toneClass : '')
      }
      data-screen-label="scan-banner"
    >
      <span className="scan-banner-glyph">{glyph}</span>

      <div className="scan-banner-body">
        {running ? (
          <>
            <div className="scan-banner-textrow">
              <span className="scan-banner-label">
                {determinate ? (
                  <>
                    {phase}
                    <span className="scan-banner-count mono">
                      {processed}/{total}
                    </span>
                    <span className="scan-banner-pct mono">{pct}%</span>
                  </>
                ) : (
                  <>
                    Processing…
                    <span className="scan-banner-count mono">
                      {processed} done
                    </span>
                  </>
                )}
              </span>
              <span className="scan-banner-item mono">{currentItem}</span>
            </div>
            <div
              className={
                'scan-progress' + (determinate ? '' : ' scan-progress-indet')
              }
            >
              <div
                className="scan-progress-fill"
                style={determinate ? { width: pct + '%' } : undefined}
              />
            </div>
          </>
        ) : state === 'done' ? (
          <span className="scan-banner-msg">
            Scan complete <span className="dot">·</span>{' '}
            <span className="mono">
              +{added} / −{removed}
            </span>{' '}
            tracks
          </span>
        ) : (
          <span className="scan-banner-msg">
            Scan failed <span className="dot">·</span> see log
          </span>
        )}
      </div>

      <div className="scan-banner-actions">
        <a className="scan-details" href={hrefFor({ name: 'scan' })}>
          Details
        </a>
        {!running && (
          <button
            className="scan-banner-x"
            aria-label="Dismiss scan"
            onClick={onClose}
          >
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
