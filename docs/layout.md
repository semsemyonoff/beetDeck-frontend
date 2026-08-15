# Repository layout

Reference for `CLAUDE.md` → _Layout_. Orientation only — the tree is authoritative,
this file is not. Every `src/lib/` module has a co-located `*.test.js`, and most
`ui/` and `pages/` modules have a `*.test.jsx`; those are omitted below.

```
.
├── index.html              # Vite entry HTML (inline FOUC-fix script + loads src/main.jsx)
├── vite.config.js          # dev proxy, prod base, manifest, Vitest block (jsdom)
├── eslint.config.js        # ESLint flat config (React + hooks + react-refresh + vitest globals)
├── .prettierrc.json
├── package.json
├── test/
│   └── setup.js            # @testing-library/jest-dom for Vitest
└── src/
    ├── main.jsx            # React entry; mounts <App>, imports styles.css
    ├── App.jsx             # Shell: topbar, search, rescan polling, route switch
    ├── useHashRoute.js     # useHashRoute() / useRouteLink / isModifiedClick; re-exports navigate()
    ├── styles.css          # All styling: dark default (:root), light (:root[data-theme="light"])
    ├── assets/             # logo.png
    ├── lib/                # Pure helpers (no React — except the use*.js hooks)
    │   ├── route.js        # parse(hash) / navigate(target) / hrefFor(target)
    │   ├── albums.js       # mapAlbum / albumLabel / isIdentified / needsReview
    │   ├── library.js      # mapApi / totals / sortArtists / filterArtists / filterAlbums / letterGroups
    │   ├── disc.js         # basename / fmtMins / fmtTotal / parseLength / discStats / groupByDisc
    │   ├── diff.js         # distanceToScore / buildDiffRows / buildAlbumDiffRows / buildLyricsPreview
    │   ├── lyrics.js       # parseLyricLines / isSynced
    │   ├── artwork.js      # sortImages / typeCounts / filterByType / pickThumbSize /
    │   │                   #   slideDimensions / formatFetchedAt / provenanceLine
    │   ├── scan.js         # buildScanSummary / buildScanViewModel / scanProgressPct /
    │   │                   #   isIndeterminate / applyLogChunk / parseLogLines / classifyLogLevel
    │   ├── tagEditor.js    # dirname / groupUntagged / excludeUntagged / summarize /
    │   │                   #   applyBulk / rowDirty / batchPayload
    │   ├── itemTags.js     # mergeRows / delta / addableFields (ItemTagsEditor)
    │   ├── platform.js     # isMac / searchShortcut → ⌘K / Ctrl K search hotkey
    │   ├── lyricsFetchQueue.js  # runLyricsFetchQueue, CONCURRENCY = 6
    │   ├── bpmComputeQueue.js   # runBpmComputeQueue, CONCURRENCY = 2
    │   ├── useModalDismiss.js   # React hook: Escape-to-close for modals
    │   └── useDocumentTitle.js  # React hook: per-page document.title (tab title)
    ├── ui/                 # Shared widgets
    │   ├── RouteLink.jsx       # <a href> wrapper over useRouteLink
    │   ├── ScanBanner.jsx      # Sticky scan progress/result banner (consumes the scan view model)
    │   ├── Topbar.jsx  Icon.jsx  Segmented.jsx
    │   ├── Cover.jsx           # Album cover; SVG palette placeholder when has_cover is false
    │   ├── IdentifyModal.jsx        # Album identify flow
    │   ├── ItemsIdentifyModal.jsx   # Untagged-items identify flow
    │   ├── useTagRows.js       # Editor state hook: rows, selection, setField, applyBulk, commit
    │   ├── FolderTree.jsx      # Folder path tree with per-file basenames and durations
    │   ├── TagTable.jsx        # Editable per-track grid (track #, title, artist, album, year)
    │   ├── BulkBar.jsx         # Bulk-apply bar for album-level fields
    │   ├── UntaggedGroup.jsx   # Pinned amber banner in Library
    │   ├── TagEditorModal.jsx  # Album tag editor (Album page → "Edit tags")
    │   ├── ItemTagsEditor.jsx  # Per-track free tag editor over all editable beets fields
    │   ├── AlbumLyricsModal.jsx # Album lyrics fetch→preview→confirm (props-driven state machine)
    │   ├── AlbumBpmModal.jsx    # Album BPM progress (no apply step — writes immediately)
    │   └── ArtLightbox.jsx      # Artwork overlay: metadata + Set-as-cover, and the
    │                            #   PhotoSwipe fullscreen layer over the filtered list
    └── pages/              # Route views
        ├── Library.jsx     # Index + Wall layouts
        ├── Artist.jsx
        ├── Album.jsx       # Owns the lyrics/BPM network calls the modals render
        ├── Artwork.jsx     # Cover Art Archive gallery; owns the listing fetch and
        │                   #   the apply POST the lightbox renders
        ├── Untagged.jsx
        └── ScanLog.jsx     # Offset-polls the scan log, level-colored lines, auto-scroll while live
```
