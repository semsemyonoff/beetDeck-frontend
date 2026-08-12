export default function Segmented({
  value,
  options,
  onChange,
  size = 'md',
  disabled = false,
}) {
  return (
    <div className={'segmented seg-' + size}>
      {options.map((o) => (
        <button
          key={o.value}
          className={'seg-btn' + (value === o.value ? ' seg-active' : '')}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <span className="seg-icon">{o.icon}</span> : null}
          {o.label}
          {o.badge != null ? (
            <span className="seg-badge">{o.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
