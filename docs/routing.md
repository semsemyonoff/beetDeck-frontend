# Routing helpers and the RouteLink pattern

Reference for `CLAUDE.md` → _Routing_. The rule lives there; this is the API and
the layout recipe.

## Why anchors

All navigable UI (album cards, artist names, breadcrumbs, search results, folder
rows) must be real `<a href>` elements so the browser enables middle-click,
Ctrl/Cmd+click, and the "Open in new tab" context menu. An `onClick` that calls
`navigate()` silently breaks all three.

## The four abstractions

| API                    | Where              | What it gives you                                                                                                                                                                                         |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hrefFor(target)`      | `lib/route.js`     | The `#/…` hash string for a target object. Pure JS, no React — use it wherever you just need the URL.                                                                                                     |
| `useRouteLink(target)` | `useHashRoute.js`  | `{ href, onClick }`. The handler intercepts **only** a plain left-click (no modifiers, `button === 0`, not `defaultPrevented`) for in-place SPA navigation; everything else falls through to the browser. |
| `isModifiedClick(e)`   | `useHashRoute.js`  | `true` for a middle/right click or any modifier key. Use it in side-effect handlers — e.g. closing the search overlay only on a plain click.                                                              |
| `<RouteLink>`          | `ui/RouteLink.jsx` | Thin `<a>` wrapper over the hook. Props: `target`, optional `className`, `children`, and an optional `onClick` for side effects (fires before the hook's handler). Use it for standalone links.           |

## Nested cards — the stretched-link pattern

A card that is itself a link but contains a second link (an album card wrapping
cover + title, with a sibling artist link) cannot use nested anchors. Instead:

1. The card becomes a positioned container (`position: relative`).
2. The primary link gets a full-card `::after` overlay at `z-index: 0`.
3. The secondary link sits above it at `z-index: 1`.
4. Decorative absolutely-positioned siblings get `pointer-events: none` so they
   do not swallow clicks meant for the overlay.

Reference implementation: `.wall-card` / `.wall-card-link` in `src/styles.css`
(around line 813).
