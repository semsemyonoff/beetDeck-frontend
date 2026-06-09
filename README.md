# beetDeck frontend

React 18 + Vite single-page app for [beetDeck](https://beets.io). It talks to the
beetDeck backend purely over HTTP (`/api`, `/static`) — there is no shared code or
filesystem with the backend.

## Requirements

- Node.js 20+

## Dev workflow

```bash
npm install
npm run dev          # Vite dev server on :5173 with HMR
```

The dev server proxies `/api` and `/static` to the backend. By default it targets
`http://localhost:5000`; point it elsewhere with the `BACKEND_URL` env var:

```bash
BACKEND_URL=http://localhost:5001 npm run dev
```

Open `http://localhost:5173` — edits hot-reload.

## Production build

```bash
npm run build        # outputs to dist/ with a Vite manifest
```

The build uses `base: '/static/dist/'`, because in production the backend serves
the bundle from `/static/dist/` and reads the Vite manifest to inject the hashed
entry JS/CSS into its page shell. Copy the built `dist/` into the backend's
`src/static/dist/` to serve the UI from the backend.

The backend repo's `make sync-frontend-dist` target does both steps in one
command (build here, copy there). See the backend README for details.

## Linting & formatting

```bash
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```

## Layout

- `index.html` — Vite entry (loaded by the dev server; in prod the built assets are injected into the backend's page shell via the Vite manifest).
- `src/main.jsx` — React entry, imports `styles.css`.
- `src/App.jsx` — top-level shell, hash-routed via `useHashRoute.js`.
- `src/ui/` — shared widgets (Topbar, Icon, Segmented, Cover, IdentifyModal).
- `src/pages/` — Library, Artist, Album, Untagged.
- `src/styles.css` — accent `#ec4868` and cozy density are fixed.

## Conventions

- Plain JavaScript + JSX (no TypeScript).
- No router library — `useHashRoute.js` is the whole router. Routes: `#/`, `#/artist/<name>`, `#/album/<id>`, `#/untagged`. Artist names are `encodeURIComponent`'d.
- No state management library — `useState` / `useReducer` only.
- Absolute API paths (`/api/...`) so the dev proxy and prod both work.
- New fields on existing backend endpoints are additive only.
