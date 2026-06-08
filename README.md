# beetDeek frontend

React 18 + Vite SPA. Source for what Flask serves at `/`.

## Layout

- `index.html` — Vite entry (loaded directly by the dev server; in prod the built assets are injected into `src/templates/index.html` via the Vite manifest).
- `src/main.jsx` — React entry, imports `styles.css`.
- `src/App.jsx` — top-level shell, hash-routed via `useHashRoute.js`.
- `src/ui/` — shared widgets (Topbar, Icon, Segmented, Cover, CoverStack).
- `src/pages/` — Library (Index + Wall), Artist, Album, Untagged, IdentifyModal, LyricsModal, etc.
- `src/styles.css` — ported from `docs/design/project/styles.css`. Accent `#ec4868` and cozy density are fixed; do not add Tweaks panel.

## Dev workflow

Run Flask and Vite concurrently:

```bash
make dev
```

That starts `python app.py` on `:5000` and `vite` on `:5173`. The Vite config proxies `/api` and `/static` to Flask, so open `http://localhost:5173` while developing — edits hot-reload.

Or run them separately:

```bash
python app.py                  # terminal 1, Flask on :5000
cd frontend && npm run dev     # terminal 2, Vite on :5173
```

## Production build

```bash
make build-frontend
```

Outputs to `../src/static/dist/` (configured via `vite.config.js` `build.outDir`). Flask reads the Vite manifest at request time and injects the hashed entry JS/CSS into `src/templates/index.html`. The `make build` target runs this inside the multi-stage Dockerfile, so you only need `make build-frontend` for local prod previews (`python app.py` then visit `:5000`).

## Conventions

- Plain JavaScript + JSX (no TypeScript).
- No router library — `useHashRoute.js` is the whole router. Routes: `#/`, `#/artist/<name>`, `#/album/<id>`, `#/untagged`. Artist names are `encodeURIComponent`'d.
- No state management library — `useState` / `useReducer` only.
- Absolute API paths (`/api/...`) so the dev proxy and prod both work.
- API contract lives in the project root `CLAUDE.md`; new fields on existing endpoints are additive only.

## Visual source of truth

`docs/design/` (JSX prototypes + chat transcript). See `docs/design/README-USAGE.md` for which decisions are fixed.
