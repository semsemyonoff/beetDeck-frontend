# beetDeck frontend

React 19 + Vite single-page app for [beetDeck](https://beets.io). It talks to the
beetDeck backend purely over HTTP (`/api`, `/static`) — there is no shared code or
filesystem with the backend.

## Requirements

- Node.js 24+ (see `engines` in `package.json`)

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
entry JS/CSS into its page shell. Copy the built `dist/` into the backend repo's
`beetdeck/static/dist/` to serve the UI from the backend.

## Testing

```bash
npm test             # vitest run (single pass)
npm run test:watch   # vitest (watch mode)
npm run test:cov     # vitest run --coverage
```

Tests live next to the modules they cover. All pure helpers in `src/lib/` have
table-driven unit tests; components and pages have React Testing Library suites.
`vite.config.js` sets `environment: 'jsdom'` globally and `test/setup.js` loads
`@testing-library/jest-dom`.

## Linting & formatting

```bash
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```

## Further documentation

- `CLAUDE.md` — notes for AI agents: conventions, routing rules, and the
  client-side invariants around the fetch queues and the scan view model.
- `docs/layout.md` — annotated source tree.
- `docs/routing.md` — the `RouteLink` API and the stretched-link card pattern.
