# beetDeck frontend — project documentation

## Project Overview

This repository is the **frontend** of beetDeck — a React 19 + Vite single-page
app for browsing and managing a [beets](https://beets.io) music library. It
renders the library browser, artist/album pages, and the cover-art, genre,
lyrics, and identification flows. It consumes the beetDeck backend purely over
HTTP (`/api`, `/static`); there is no shared code or filesystem with the backend.

## Tech Stack

- **Framework**: React 19 (function components + hooks only)
- **Build tool**: Vite 8 with `@vitejs/plugin-react`
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
    ├── useHashRoute.js     # useHashRoute() hook; useRouteLink/isModifiedClick; re-exports navigate() from lib/route.js
    ├── styles.css          # All styling: dark default (:root), light override (:root[data-theme="light"])
    ├── assets/             # Static assets (logo.png)
    ├── lib/                # Pure helpers (no React imports) — each has a co-located *.test.js
    │   ├── route.js        # parse(hash) / navigate(target) / hrefFor(target)
    │   ├── albums.js       # mapAlbum / isIdentified(album) / needsReview(album)
    │   ├── library.js      # mapApi / totals / sortArtists / filterArtists / filterAlbums / letterGroups
    │   ├── disc.js         # basename / fmtMins / fmtTotal / parseLength / discStats / groupByDisc
    │   ├── diff.js         # distanceToScore / buildDiffRows / buildAlbumDiffRows / buildLyricsPreview
    │   ├── scan.js         # buildScanSummary (rescan-status diff → banner counts)
    │   ├── tagEditor.js    # dirname / groupUntagged / excludeUntagged / summarize / applyBulk / rowDirty / batchPayload
    │   ├── platform.js     # isMac(nav) / searchShortcut(nav) → { mac, label, matches(event) } for the ⌘K/Ctrl K search hotkey
    │   ├── lyricsFetchQueue.js  # runLyricsFetchQueue — client pool (max 6) of single-track fetch requests; AbortSignal cancel; progress + per-track callbacks
    │   ├── bpmComputeQueue.js  # runBpmComputeQueue — client pool (max 2, CPU-bound) for single-track BPM compute; onTrackStart fires before each fetch; AbortSignal only stops dequeuing (in-flight writes always settle)
    │   └── useModalDismiss.js  # React hook: Escape-to-close for modals (backdrop-click is wired per modal)
    ├── ui/                 # Shared widgets
    │   ├── RouteLink.jsx       # <a href> wrapper over useRouteLink; plain left-click = SPA nav, modified/middle/right = browser
    │   ├── Topbar.jsx
    │   ├── Icon.jsx
    │   ├── Segmented.jsx
    │   ├── Cover.jsx           # Album cover; SVG palette placeholder when has_cover is false
    │   ├── IdentifyModal.jsx
    │   ├── useTagRows.js       # Editor state hook: rows, selection, setField, applyBulk, commit, summary
    │   ├── FolderTree.jsx      # Folder path tree with per-file basenames and durations
    │   ├── TagTable.jsx        # Editable per-track grid (track #, title, artist, album, year)
    │   ├── BulkBar.jsx         # Bulk-apply bar for album-level fields → "Apply to N"
    │   ├── UntaggedGroup.jsx   # Pinned amber banner in Library (UntaggedGroup + UntaggedFolderRow)
    │   ├── ItemsIdentifyModal.jsx  # Item-identify flow (identify → poll → apply → confirm → navigate)
    │   ├── TagEditorModal.jsx  # Album tag editor modal (opened from Album page *Edit tags* action)
    │   ├── AlbumLyricsModal.jsx  # Album lyrics fetch-preview-confirm modal (props-driven; state machine: pending/found/applying/applied/skipped/not-found/error)
    │   └── AlbumBpmModal.jsx    # Album BPM progress modal (no apply step — writes immediately); per-track rows pending→computing→done/error; driven by runBpmComputeQueue
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
- `#/untagged` — Untagged folder index (pinned amber banner; folder list fallback)
- `#/untagged/<dir>` — Per-folder tag editor (dir is `encodeURIComponent`'d; decoded once in `parse()`)

Anything unrecognized falls back to the Library route.

### Adding navigable entities — RouteLink pattern

All navigable UI elements (album cards, artist names, breadcrumbs, search results,
folder rows) must be real `<a href>` elements so the browser enables middle-click,
Ctrl/Cmd+click, and the "Open in new tab" context menu. Use the shared abstractions:

- **`hrefFor(target)`** in `lib/route.js` — builds the `#/...` hash string for any
  target object. Pure JS, no React. Use this wherever you need the URL string.
- **`useRouteLink(target)`** in `useHashRoute.js` — returns `{ href, onClick }`.
  The handler intercepts only a plain left-click (no modifiers, `button === 0`,
  not `defaultPrevented`) for in-place SPA navigation; everything else falls through
  to the browser.
- **`isModifiedClick(e)`** in `useHashRoute.js` — `true` when the event is a
  middle/right click or has a modifier key. Use this in side-effect `onClick`
  callbacks (e.g. closing a search overlay only on plain clicks).
- **`<RouteLink>`** in `ui/RouteLink.jsx` — thin `<a>` wrapper over the hook.
  Pass `target`, optional `className`, `children`, and an optional `onClick` for
  side effects (fires before the hook's handler). Use this for standalone links.

For **nested cards** (an album link wrapping cover + title, with a sibling artist
link): use the stretched-link pattern — no nested anchors. The card becomes a
positioned container (`position: relative`), the primary link gets a full-card
`::after` overlay (`z-index: 0`), and the secondary link sits above (`z-index: 1`).
Mark decorative absolutely-positioned siblings (`pointer-events: none`) so they
don't block the overlay. See `.wall-card` in `styles.css` for the reference
implementation.

Toggle/action buttons (`lib-row-head`, `unt-banner-bar`, scan, theme) stay plain
`<button>` elements. Programmatic navigations that follow async actions (e.g.
post-identify redirect) stay `navigate()`.

## Backend API

The UI calls the backend with **absolute** paths (`/api/...`) so the same code
works behind the dev proxy and in production. In dev, `vite.config.js` proxies
`/api` and `/static` to the backend (`BACKEND_URL`, default `http://localhost:5000`).
New fields on existing endpoints are treated as additive only.

Patterns used against the API:

- `App.jsx` polls `GET /api/rescan/status` on an interval while a rescan runs.
- `IdentifyModal.jsx` drives the identify flow (`identify` → poll `status` → `apply` → `confirm`).
- `TagEditorModal.jsx` and the untagged folder editor post to `POST /api/items/metadata-batch` for album-level + per-track tag writes in one request.
- `ItemsIdentifyModal.jsx` drives the items identify flow (same polling cycle as `IdentifyModal`).
- `AlbumLyricsModal` + `lyricsFetchQueue` drive the album "Fetch all" lyrics flow:
  `runLyricsFetchQueue` fans out up to 6 concurrent `POST /api/album/<id>/track/<id>/lyrics/fetch`
  calls (with an `AbortSignal`); the modal writes via `POST /api/album/<id>/track/<id>/lyrics/confirm`
  (individual track) or `POST /api/album/<id>/lyrics/confirm` with `item_ids` ("Apply all"; response
  includes `written_item_ids` — only those tracks are marked applied). Confirm requests are NOT
  aborted when the modal closes (writes to disk are not idempotent).
- `AlbumBpmModal` + `bpmComputeQueue` drive the album "BPM all" flow:
  `runBpmComputeQueue` fans out up to 2 concurrent `POST /api/album/<id>/track/<id>/bpm/compute`
  calls (CPU-bound; ~9s/track via librosa). The `AbortSignal` only stops dequeuing new tracks —
  in-flight writes are never aborted because the server keeps computing/writing regardless, and
  aborting mid-write is not idempotent. The queue promise resolves only after all in-flight requests
  settle, letting the page keep the album run locked and prevent a second overlapping run.
  `has_bpm` on each track in `GET /api/album/<id>` allows the UI to color buttons on first paint.

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
# watch / coverage have no dedicated dwe command; invoke the npm script directly:
dwe cmd frontend.npm --set args="run test:watch"   # watch mode
dwe cmd frontend.npm --set args="run test:cov"     # with coverage
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
  `index.html` _before_ the module loads (prevents FOUC).
- The Topbar cycles `auto → light → dark`, persisting to `localStorage.theme`.
- Shared tokens (`--accent: #ec4868`, `--ok`, `--warn`, `--danger`) are not
  overridden per theme unless contrast requires it.

## Conventions

- Function components and hooks only; no class components.
- Keep `react/jsx-runtime` style (no explicit `React` import needed for JSX).
- Absolute API paths; no hardcoded backend origin in components.
- Pure helpers (no React) live in `src/lib/`; each module has a co-located test.
- Use `useModalDismiss` from `src/lib/useModalDismiss.js` on every modal for
  Escape-to-close; backdrop-click dismissal is wired per modal in the JSX.
- Run `npm run lint` and `npm run format` before committing.
