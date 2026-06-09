import { useEffect, useState } from 'react';
import { parse, navigate as _navigate } from './lib/route.js';

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
