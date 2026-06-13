const HASH_CACHE = new Map();
function hash(str) {
  if (HASH_CACHE.has(str)) return HASH_CACHE.get(str);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  HASH_CACHE.set(str, h);
  return h;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function defaultPalette(title) {
  const h = hash(title);
  const hues = [h % 360, (h >>> 8) % 360, (h >>> 16) % 360];
  return hues.map((hue) => `hsl(${hue}, 55%, 45%)`);
}

import { useEffect, useState } from 'react';

export function Cover({
  album,
  size = 200,
  rounded = 6,
  showTitle = true,
  dim = false,
}) {
  const title = album.title || album.album || '';
  const id = album.id;
  const hasCover = album.has_cover === true || album.hasCover === true;
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => setCoverFailed(false), [id, hasCover]);

  if (hasCover && id != null && !coverFailed) {
    return (
      <div
        className={'cover' + (dim ? ' cover-dim' : '')}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          flex: '0 0 ' + size + 'px',
        }}
      >
        <img
          src={`/api/album/${id}/cover`}
          alt=""
          onError={() => setCoverFailed(true)}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: rounded,
          }}
        />
      </div>
    );
  }

  const palette =
    album.palette && album.palette.length
      ? album.palette
      : defaultPalette(title);
  const seed = hash(title + '/' + palette.join(','));
  const r = rng(seed);
  const pick = (i) => palette[i % palette.length];
  const variant = Math.floor(r() * 6);
  const [c0, c1, c2] = [pick(0), pick(1), pick(2 % palette.length)];
  const initials = title
    .replace(/[[(].*?[\])]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const W = 100;
  const H = 100;
  let composition = null;

  if (variant === 0) {
    const cx = 30 + r() * 40;
    const cy = 30 + r() * 40;
    composition = (
      <>
        <rect width={W} height={H} fill={c0} />
        <circle cx={cx} cy={cy} r={32 + r() * 18} fill={c1} opacity="0.92" />
        <circle cx={cx} cy={cy} r={6 + r() * 4} fill={c2} opacity="0.75" />
      </>
    );
  } else if (variant === 1) {
    const split = 30 + r() * 40;
    composition = (
      <>
        <rect width={W} height={split} fill={c0} />
        <rect y={split} width={W} height={H - split} fill={c1} />
        <rect y={split - 1} width={W} height="2" fill={c2} opacity="0.7" />
      </>
    );
  } else if (variant === 2) {
    const p = 20 + r() * 60;
    composition = (
      <>
        <rect width={W} height={H} fill={c0} />
        <polygon points={`0,${H} ${p},0 ${W},0 ${W},${H}`} fill={c1} />
        <polygon
          points={`0,${H} ${p / 2},${H * 0.6} ${p},0 0,0`}
          fill={c2}
          opacity="0.55"
        />
      </>
    );
  } else if (variant === 3) {
    composition = (
      <>
        <rect width={W} height={H} fill={c0} />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={c1}
          strokeWidth="4"
        />
        <circle
          cx="50"
          cy="50"
          r="28"
          fill="none"
          stroke={c2}
          strokeWidth="3"
          opacity="0.8"
        />
        <circle cx="50" cy="50" r="14" fill={c1} />
      </>
    );
  } else if (variant === 4) {
    composition = (
      <>
        <rect width={W} height={H} fill={c0} />
        <circle
          cx={20 + r() * 60}
          cy={20 + r() * 30}
          r={18 + r() * 10}
          fill={c1}
        />
        <rect y={70} width={W} height={30} fill={c2} opacity="0.7" />
      </>
    );
  } else {
    const stripes = 3 + Math.floor(r() * 3);
    const w = W / stripes;
    composition = (
      <>
        <rect width={W} height={H} fill={c0} />
        {Array.from({ length: stripes }, (_, i) => (
          <rect
            key={i}
            x={i * w}
            y="0"
            width={w * (0.6 + r() * 0.4)}
            height={H}
            fill={i % 2 === 0 ? c1 : c2}
            opacity={0.7 + r() * 0.3}
          />
        ))}
      </>
    );
  }

  return (
    <div
      className={'cover' + (dim ? ' cover-dim' : '')}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        flex: '0 0 ' + size + 'px',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ display: 'block', borderRadius: rounded }}
      >
        {composition}
        {showTitle && (
          <text
            x="50%"
            y="92%"
            textAnchor="middle"
            fontFamily="Geist, system-ui, sans-serif"
            fontWeight="700"
            fontSize={initials.length === 1 ? 8 : 7}
            fill="rgba(255,255,255,0.92)"
            letterSpacing="0.5"
          >
            {title.length > 22 ? title.slice(0, 21) + '…' : title}
          </text>
        )}
      </svg>
    </div>
  );
}

export function CoverStack({ albums, size = 36 }) {
  const top = (albums || []).slice(0, 3);
  return (
    <div className="cover-stack" style={{ width: size + 10, height: size }}>
      {top.map((a, i) => (
        <div
          key={i}
          className="cover-stack-item"
          style={{
            left: i * 5,
            top: i * 1,
            zIndex: 10 - i,
            transform: `rotate(${(i - 1) * 4}deg)`,
          }}
        >
          <Cover album={a} size={size} rounded={3} showTitle={false} />
        </div>
      ))}
    </div>
  );
}
