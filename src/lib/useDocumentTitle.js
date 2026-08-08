import { useEffect } from 'react';

// Kept in sync with the static <title> in index.html, which is what the tab
// shows until React mounts.
export const APP_NAME = 'beetDeck';

export function formatDocumentTitle(pageTitle) {
  const t = (pageTitle || '').trim();
  return t ? `${t} · ${APP_NAME}` : APP_NAME;
}

// Owns document.title for as long as the caller is mounted, and hands it back
// to the bare app name on unmount — pages that don't call it keep the default.
export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle);
    return () => {
      document.title = APP_NAME;
    };
  }, [pageTitle]);
}
