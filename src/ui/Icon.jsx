export default function Icon({ name, size = 14 }) {
  const s = {
    width: size,
    height: size,
    display: 'inline-block',
    verticalAlign: '-2px',
  };
  const sw = 1.6;
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'search':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="11" cy="11" r="7" {...common} />
          <path d="M21 21l-4.3-4.3" {...common} />
        </svg>
      );
    case 'scan':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path
            d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M3 12h18"
            {...common}
          />
        </svg>
      );
    case 'zap':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <polygon points="13,2 3,14 11,14 9,22 21,10 13,10" {...common} />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M21 12a9 9 0 1 1-3-6.7M21 4v6h-6" {...common} />
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="3" y="3" width="7" height="7" rx="1" {...common} />
          <rect x="14" y="3" width="7" height="7" rx="1" {...common} />
          <rect x="3" y="14" width="7" height="7" rx="1" {...common} />
          <rect x="14" y="14" width="7" height="7" rx="1" {...common} />
        </svg>
      );
    case 'list':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M3 6h18M3 12h18M3 18h18" {...common} />
        </svg>
      );
    case 'split':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="3" y="4" width="6" height="16" rx="1" {...common} />
          <rect x="11" y="4" width="10" height="16" rx="1" {...common} />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 12l5 5L20 6" {...common} />
        </svg>
      );
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path
            d="M12 8v5M12 17h.01M10.3 3.86 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z"
            {...common}
          />
        </svg>
      );
    case 'chevron':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M9 6l6 6-6 6" {...common} />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M19 12H5M12 19l-7-7 7-7" {...common} />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M6 6l12 12M18 6L6 18" {...common} />
        </svg>
      );
    case 'sparkles':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path
            d="M5 3v4M3 5h4M19 13v4M17 15h4M13 3l2.5 6L21 12l-5.5 3L13 21l-2.5-6L5 12l5.5-3L13 3z"
            {...common}
          />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" {...common} />
        </svg>
      );
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 18V6M7 11l5-5 5 5M5 21h14" {...common} />
        </svg>
      );
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 20h4l10-10-4-4L4 16v4z" {...common} />
        </svg>
      );
    case 'lyrics':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path
            d="M9 18V5l12-2v13M9 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM21 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"
            {...common}
          />
        </svg>
      );
    case 'bpm':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M2 12h3l2-7 3 14 2-8 3 5 2-4h5" {...common} />
        </svg>
      );
    case 'tag':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z" {...common} />
          <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'disc':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" {...common} />
          <circle cx="12" cy="12" r="3" {...common} />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="3" y="5" width="18" height="16" rx="2" {...common} />
          <path d="M3 10h18M8 3v4M16 3v4" {...common} />
        </svg>
      );
    case 'filter':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" {...common} />
        </svg>
      );
    case 'ignore':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" {...common} />
          <path d="M5.6 5.6l12.8 12.8" {...common} />
        </svg>
      );
    case 'more':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      );
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path
            d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
            {...common}
          />
        </svg>
      );
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="4" {...common} />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            {...common}
          />
        </svg>
      );
    default:
      return null;
  }
}
