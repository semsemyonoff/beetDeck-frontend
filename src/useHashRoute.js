import { useEffect, useState } from 'react';
import { parse, navigate as _navigate, hrefFor } from './lib/route.js';

export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// Re-exported so existing `import { navigate } from '../useHashRoute.js'` call
// sites continue to work without an import sweep.
export { _navigate as navigate };

export function isModifiedClick(e) {
  return Boolean(
    e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
  );
}

export function useRouteLink(target) {
  const href = hrefFor(target);
  const onClick = (e) => {
    if (e.defaultPrevented) return;
    if (isModifiedClick(e)) return;
    e.preventDefault();
    _navigate(target);
  };
  return { href, onClick };
}
