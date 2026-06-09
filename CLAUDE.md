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
├── index.html              # Vite entry HTML (loads src/main.jsx)
├── vite.config.js          # Vite config: dev proxy, prod base, manifest
├── eslint.config.js        # ESLint flat config (React + hooks + react-refresh)
├── .prettierrc.json        # Prettier config
├── package.json
└── src/
    ├── main.jsx            # React entry; mounts <App>, imports styles.css
    ├── App.jsx             # Top-level shell: topbar, search, rescan polling, route switch
    ├── useHashRoute.js     # useHashRoute() hook + navigate() helper
    ├── styles.css          # All styling (accent #ec4868, light/dark)
    ├── assets/             # Static assets (logo.png)
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

## Conventions

- Function components and hooks only; no class components.
- Keep `react/jsx-runtime` style (no explicit `React` import needed for JSX).
- Absolute API paths; no hardcoded backend origin in components.
- Run `npm run lint` and `npm run format` before committing.
