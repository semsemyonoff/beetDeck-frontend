# beetDeck frontend — project documentation

## Project Overview

This repository is the **frontend** of beetDeck — a React 18 + Vite single-page
app for browsing and managing a [beets](https://beets.io) music library. It
renders the library browser, artist/album pages, and the cover-art, genre,
lyrics, and identification flows. It consumes the beetDeck backend purely over
HTTP (`/api`, `/static`); there is no shared code or filesystem with the backend.

## Tech Stack

- **Framework**: React 18 (function components + hooks only)
- **Build tool**: Vite 5 with `@vitejs/plugin-react`
- **Language**: plain JavaScript + JSX (no TypeScript)
- **Routing**: hash-based, hand-rolled in `useHashRoute.js` (no router library)
- **State**: `useState` / `useReducer` only (no state-management library)
- **Tooling**: ESLint (flat config) + Prettier

## Project Structure

```
.
├── index.html              # Vite entry HTML (inline FOUC-fix script + loads src/main.jsx)
├── vite.config.js          # Vite config: dev proxy, prod base, manifest, Vitest block
├── eslint.config.js        # ESLint flat config (React + hooks + react-refresh + vitest globals)
├── .prettierrc.json        # Prettier config
├── package.json
├── test/
│   └── setup.js            # @testing-library/jest-dom imports for Vitest
└── src/
    ├── main.jsx            # React entry; mounts <App>, imports styles.css
    ├── App.jsx             # Top-level shell: topbar, search, rescan polling, route switch
    ├── useHashRoute.js     # useHashRoute() hook; re-exports navigate() from lib/route.js
    ├── styles.css          # All styling: dark default (:root), light override (:root[data-theme="light"])
    ├── assets/             # Static assets (logo.png)
    ├── lib/                # Pure helpers (no React imports) — each has a co-located *.test.js
    │   ├── route.js        # parse(hash) / navigate(target) / encodeArtist
    │   ├── albums.js       # isIdentified(album) / needsReview(album) / mapAlbum
    │   ├── library.js      # filterAlbums / sortAlbums / groupByLetter / libraryTotals
    │   ├── disc.js         # byDisc / stats / parseLength / fmtMins / fmtTotal / basename
    │   ├── diff.js         # buildDiffRows / buildAlbumDiffRows / distanceToScore / buildLyricsPreview
    │   └── useModalDismiss.js  # React hook: Escape-to-close + backdrop-click for modals
    ├── ui/                 # Shared widgets
    │   ├── Topbar.jsx
    │   ├── Icon.jsx
    │   ├── Segmented.jsx
    │   ├── Cover.jsx       # Album cover; SVG palette placeholder when has_cover is false
    │   └── IdentifyModal.jsx
    └── pages/              # Route views
        ├── Library.jsx     # Index + Wall layouts
        ├── Artist.jsx
        ├── Album.jsx
        └── Untagged.jsx
```

## Routing

`useHashRoute.js` is the entire router. `useHashRoute()` parses `window.location.hash`
into a route object; `navigate(target)` writes the hash. Routes:

- `#/` — Library
- `#/artist/<name>` — Artist (name is `encodeURIComponent`'d)
- `#/album/<id>` — Album
- `#/untagged` — Untagged items

Anything unrecognized falls back to the Library route.

## Backend API

The UI calls the backend with **absolute** paths (`/api/...`) so the same code
works behind the dev proxy and in production. In dev, `vite.config.js` proxies
`/api` and `/static` to the backend (`BACKEND_URL`, default `http://localhost:5000`).
New fields on existing endpoints are treated as additive only.

Patterns used against the API:
- `App.jsx` polls `GET /api/rescan/status` on an interval while a rescan runs.
- `IdentifyModal.jsx` drives the identify flow (`identify` → poll `status` → `apply` → `confirm`).

## Build & Dev

```bash
npm install
npm run dev            # Vite dev server on :5173 (HMR), proxies /api + /static
npm run build          # production build -> dist/ with a Vite manifest
npm run lint           # ESLint
npm run format         # Prettier (write)
```

- **Dev**: `base` is `/` and the dev server proxies API calls to the backend.
- **Prod**: `base` is `/static/dist/`; the backend serves the bundle from
  `/static/dist/` and reads the Vite manifest to inject the hashed entry JS/CSS.
  Place the built `dist/` into the backend's `src/static/dist/`. The one-command
  hand-off is `make sync-frontend-dist` from the backend repo — see the backend
  `README.md` "Syncing the frontend build" section for details.

## Testing

Vitest + React Testing Library. Run inside the DWE container:

```bash
dwe cmd frontend.test          # run once (npm test)
dwe cmd frontend.test:watch    # watch mode
dwe cmd frontend.test:cov      # with coverage
```

Or directly (host node, from `services/frontend/src/`):
```bash
npm test               # vitest run
npm run test:watch     # vitest (watch)
npm run test:cov       # vitest run --coverage
```

- Co-locate tests next to the module they test (`lib/route.test.js`, etc.).
- `src/lib/` helpers are pure JS — test them with table-driven unit tests, no
  browser environment needed.
- `useModalDismiss.js` and `IdentifyModal.jsx` use RTL + jsdom; setup file is
  `test/setup.js` (imports `@testing-library/jest-dom`).
- **Every task that adds or changes pure logic must add/update Vitest tests.**
  Pure CSS/markup tweaks do not require a unit test.

## Theme

- Dark theme is the default (bare `:root` block in `styles.css`).
- Light theme overrides surface/text/border tokens via `:root[data-theme="light"]`.
  Do NOT add a `[data-theme="dark"]` selector (specificity trap).
- The `<html>` element's `data-theme` attribute is set by an inline script in
  `index.html` *before* the module loads (prevents FOUC).
- The Topbar cycles `auto → light → dark`, persisting to `localStorage.theme`.
- Shared tokens (`--accent: #ec4868`, `--ok`, `--warn`, `--danger`) are not
  overridden per theme unless contrast requires it.

## Conventions

- Function components and hooks only; no class components.
- Keep `react/jsx-runtime` style (no explicit `React` import needed for JSX).
- Absolute API paths; no hardcoded backend origin in components.
- Pure helpers (no React) live in `src/lib/`; each module has a co-located test.
- Use `useModalDismiss` from `src/lib/useModalDismiss.js` on every modal (Escape
  + backdrop-click close).
- Run `npm run lint` and `npm run format` before committing.
