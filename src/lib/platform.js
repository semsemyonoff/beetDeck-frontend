// Tiny, dependency-free, injectable platform helpers so they stay testable in
// jsdom. Every export takes the navigator as an argument (defaulting to the
// global) instead of reading it directly, so tests can pass fake shapes.

// isMac reports whether the current platform is macOS. Detection order:
// userAgentData?.platform → platform → userAgent, matched case-insensitively
// against "mac". navigator.platform is deprecated but remains the most reliable
// signal; the chain degrades gracefully when a source is missing.
export function isMac(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const candidates = [
    nav?.userAgentData?.platform,
    nav?.platform,
    nav?.userAgent,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value) {
      return value.toLowerCase().includes('mac');
    }
  }
  return false;
}

// searchShortcut returns the OS-aware descriptor for the topbar search hotkey:
// the on-screen keycap label and a matcher for keydown events. macOS uses ⌘
// (metaKey); every other platform uses Ctrl (ctrlKey). matches() rejects the
// wrong primary modifier so Cmd+Ctrl+K does not trigger, and rejects any
// Shift/Alt chord so browser shortcuts like Ctrl+Shift+K (devtools) are left
// alone.
export function searchShortcut(
  nav = typeof navigator !== 'undefined' ? navigator : {}
) {
  const mac = isMac(nav);
  return {
    mac,
    label: mac ? '⌘K' : 'Ctrl K',
    matches(event) {
      if (!event || typeof event.key !== 'string') return false;
      if (event.key.toLowerCase() !== 'k') return false;
      if (event.shiftKey || event.altKey) return false;
      return mac
        ? Boolean(event.metaKey) && !event.ctrlKey
        : Boolean(event.ctrlKey) && !event.metaKey;
    },
  };
}
