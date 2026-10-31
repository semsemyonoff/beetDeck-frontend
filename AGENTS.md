# beetDeck frontend — agent notes

React 19 + Vite single-page app for browsing and managing a [beets](https://beets.io)
music library: library browser, artist/album pages, and the cover-art, genre,
lyrics, BPM and identification flows. It consumes the beetDeck backend purely over
HTTP (`/api`, `/static`) — no shared code or filesystem with the backend.

This file records the conventions and non-obvious contracts. Mechanical detail
(the file tree, the endpoint shapes) lives elsewhere; see the pointers below.

## Tech stack

Mostly defined by what it deliberately does **not** use:

- React 19, function components and hooks only — no class components.
- Plain JavaScript + JSX — **no TypeScript**.
- Hash routing hand-rolled in `useHashRoute.js` — **no router library**.
- `useState` / `useReducer` — **no state-management library**.
- Vite 8 + `@vitejs/plugin-react`; ESLint (flat config) + Prettier; Vitest + RTL.

The one runtime dependency beyond React is **`photoswipe`** (5.x, MIT, zero
dependencies), the fullscreen image viewer behind the artwork gallery's lightbox.
It is here because pinch-zoom, pan, momentum and the gesture handling a scan
viewer needs are weeks of work to get right and none of it is beetDeck-specific.
It stays cheap because `pswpModule: () => import('photoswipe')` puts the core in
its own lazy chunk — nothing but a fullscreen open loads it, and only
`photoswipe/lightbox` plus `photoswipe/style.css` are imported eagerly, from
`ui/ArtLightbox.jsx`. Add a dependency with `dwe cmd frontend.npm -- install <pkg>`
and commit `package-lock.json`; hand-editing `package.json` and running
`frontend.install` reports success without installing anything.

## Layout

`src/lib/` holds pure helpers with a co-located `*.test.js`, `src/ui/` shared
widgets, `src/pages/` route views. Annotated tree in [`docs/layout.md`](docs/layout.md).

Two things the tree cannot show:

- `src/lib/useModalDismiss.js` and `src/lib/useDocumentTitle.js` are the two
  modules in `lib/` that import React — they are hooks, not pure helpers (hence
  their `.test.jsx`).
- `src/lib/scan.js` `classifyLogLevel` **mirrors the backend's**
  `parse_beets_line` log levels and is pinned to the beets version the backend
  pins (2.12.0). The two must change together, across repositories.
- `src/lib/mbsync.js` `buildMbsyncViewModel` follows the same one-mapper rule as
  `buildScanViewModel`: it is the single place the snake_case
  `…/mbsync` response becomes the camelCase shape `AlbumMbsyncModal` consumes,
  so a new response field gets threaded through the mapper, not read ad hoc in
  the modal. `fieldNames` is derived there rather than in the modal because it
  is the union across both levels — it is what the exclusion checkboxes list
  and what "everything is excluded" is counted against.

## Routing

`useHashRoute.js` is the entire router: `useHashRoute()` parses
`window.location.hash`, `navigate(target)` writes it. Routes:

- `#/` — Library
- `#/artist/<name>` — Artist (`encodeURIComponent`'d)
- `#/album/<id>` — Album
- `#/album/<id>/artwork` — Cover Art Archive gallery for that album
- `#/untagged` — Untagged folder index
- `#/untagged/<dir>` — per-folder tag editor (`encodeURIComponent`'d, decoded once in `parse()`)
- `#/scan` — scan log for the current/last run

Anything unrecognized falls back to Library — except an unknown suffix under
`#/album/<id>/…`, which keeps rendering the album page rather than losing the id
the URL still carries.

**Every navigable element must be a real `<a href>`** so middle-click, Ctrl/Cmd+click
and "Open in new tab" work. Use `hrefFor` / `useRouteLink` / `<RouteLink>` rather
than an `onClick` that calls `navigate()` — see [`docs/routing.md`](docs/routing.md)
for the API and the nested-card (stretched-link) pattern.

Exceptions that stay non-anchors: toggle/action buttons (`lib-row-head`,
`unt-banner-bar`, scan, theme) remain `<button>`, and navigations that follow an
async action (e.g. the post-identify redirect) stay `navigate()`.

## Talking to the backend

Call absolute paths (`/api/...`) so the same code works behind the dev proxy and
in production; never hardcode a backend origin in a component. In dev,
`vite.config.js` proxies `/api` and `/static` to `BACKEND_URL`
(default `http://localhost:5000`). New fields on existing endpoints are additive only.

The endpoint contracts are the backend's OpenAPI spec (`/apidoc/scalar/`,
`/apidoc/openapi.json`) — read them there, do not mirror them here.

Client-owned invariants:

- **The modals hold no network code.** `AlbumLyricsModal`, `AlbumBpmModal` and
  `AlbumMbsyncModal` are props-driven state machines; the requests live in
  `src/pages/Album.jsx` (mirroring its pre-existing genre flow: a monotonic
  request ref plus a busy lock) and in the two queue modules. Add a call there,
  not in the modal.
- **The MusicBrainz sync button is disabled, not explained.** `Album.jsx`
  disables the **Sync** action (in the `MusicBrainz` `ActionGroup`) when
  `data.mb_albumid` is absent rather than letting the request round-trip into a
  `400`. The modal's own Confirm is rendered only when the preview reports
  `changed` — a diff made up entirely of unmapped tracks has nothing to write,
  and confirming it would consume the stash for a no-op. Preview→confirm both
  send `expected_generation`; the confirm renders the backend's `error` (and
  `reasons` when present) instead of a hardcoded sentence — three different
  `400`s exist upstream (no id, wrong `data_source`, release not found) and
  collapsing them into one client message would state a fact about MusicBrainz
  that actually came from the local row. The two `409`s are distinguished in the
  UI too: a rescan in flight ("a library scan is running") reads differently
  from a stale preview ("the album changed, re-run the preview"). A successful
  confirm calls `setVersion` to refresh the page, same as every other write
  flow here.
- `runLyricsFetchQueue` (`CONCURRENCY = 6`) and `runBpmComputeQueue`
  (`CONCURRENCY = 2` — CPU-bound, ~9s/track on the server) pool the per-track
  fetch/compute requests.
- **An `AbortSignal` only stops dequeuing; in-flight requests are never aborted**
  and confirm/write requests are never aborted at all — the server writes to disk
  regardless and the write is not idempotent. The queue promise resolves only
  after every in-flight request settles, which is what lets the page keep the
  album run locked against a second overlapping run.
- Bulk lyrics confirm returns `written_item_ids`; mark only those tracks applied.
- **The genre preview commits through `POST …/genre/save`, never through
  `…/genre/confirm`.** `confirm` runs its own second Last.fm lookup and can write
  a value other than the one on screen; it also cannot express the `merge` mode,
  whose result exists only in the preview. The Replace/Merge switch re-requests
  `…/genre?mode=…` and the modal shows all three values (current, fetched,
  proposed) so the switch is a visible diff, not a hidden one. A second
  `Segmented` switch picks the **source** (`lastfm`/`musicbrainz`, threaded into
  the same request as `?source=…`), and the fetched value is labelled with
  whichever source produced it — switching sources re-requests rather than
  relabeling a cached answer, so the label always matches the value shown.
- A cover fetch answers with both sizes (`width`/`height` and
  `current_width`/`current_height`); `compareCoverSize` turns them into the
  is-this-an-upgrade verdict. `relaxed: true` means the backend only found the
  image with its size filter lifted — always render the `warning` with it.
- Scan status is snake_case from the API and is mapped **once** by
  `buildScanViewModel` (`src/lib/scan.js`, applied in `App.jsx`). `ScanBanner`
  consumes the camelCase view model; `runId` is consumed by `ScanLog`, not the
  banner. A new scan field must be threaded through the mapper.
- `App.jsx` also fetches rescan status once on mount, so an in-flight or
  finished-but-undismissed scan survives a page reload. The banner has no
  auto-dismiss: `×` calls `POST /api/rescan/dismiss`.

## Theme

- Dark is the default (bare `:root` in `styles.css`); light overrides
  surface/text/border tokens via `:root[data-theme="light"]`.
- **Do NOT add a `[data-theme="dark"]` selector** — specificity trap.
- `<html data-theme>` is set by an inline script in `index.html` _before_ the
  module loads (prevents FOUC). The Topbar cycles `auto → light → dark` and
  persists to `localStorage.theme`.
- Shared tokens (`--accent: #ec4868`, `--ok`, `--warn`, `--danger`) are not
  overridden per theme unless contrast requires it.

## Conventions

- Keep `react/jsx-runtime` style — no explicit `React` import for JSX.
- Pure helpers live in `src/lib/`, each with a co-located test.
- Every modal uses `useModalDismiss` for Escape-to-close; backdrop-click dismissal
  is wired per modal in the JSX.
- `document.title` belongs to `useDocumentTitle`: a page that wants a tab title
  calls it, everything else falls back to the bare app name it restores on
  unmount. Its `APP_NAME` and the static `<title>` in `index.html` (what the tab
  shows before React mounts) must stay in sync.
- Run lint and format before committing.

## Testing

Vitest + React Testing Library. `environment: 'jsdom'` is set globally in
`vite.config.js`, with `test/setup.js` importing `@testing-library/jest-dom` —
component tests need no per-file setup.

- Co-locate tests with the module under test (`lib/route.test.js`, `ui/TagTable.test.jsx`).
- `src/lib/` helpers are pure JS — table-driven unit tests, no DOM needed.
- Components, pages and hooks are covered by RTL suites (`*.test.jsx`).
- **Every change that adds or alters pure logic must add/update a Vitest test.**
  Pure CSS/markup tweaks do not.

Commands (`npm test`, `test:watch`, `test:cov`, `lint`, `format`) are listed in
`README.md`.

## Production build

`base` is `/` in dev and `/static/dist/` for `vite build`. The backend serves the
bundle from its own `beetdeck/static/dist/` and reads the Vite manifest to inject
the hashed entry JS/CSS, so a production hand-off means copying this repo's
`dist/` into the backend repo's `beetdeck/static/dist/`.
