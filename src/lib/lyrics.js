// LRC synced-lyrics helpers.
//
// "Synced" lyrics are LRC-formatted: each timed line starts with an
// `[mm:ss]` or `[mm:ss.xx]` timestamp. Plain lyrics carry no timestamps.
// LRC metadata tags like `[ar:…]`, `[ti:…]`, `[length:03:21]` are NOT
// timestamps — the regex only matches a bracket that opens with digits.

const TS_RE = /^\s*\[(\d{1,2}:\d{2}(?:[.:]\d{1,3})?)\]\s?/;

// Split lyric text into `{ ts, text }` lines, separating any leading LRC
// timestamp from the line text. Lines without a timestamp get `ts: null`.
export function parseLyricLines(text) {
  const src = text == null ? '' : String(text);
  return src.split('\n').map((raw) => {
    const m = raw.match(TS_RE);
    if (m) return { ts: m[1], text: raw.slice(m[0].length) };
    return { ts: null, text: raw };
  });
}

// True when the text carries at least one LRC timestamp (synchronized lyrics).
export function isSynced(text) {
  const src = text == null ? '' : String(text);
  return src.split('\n').some((raw) => TS_RE.test(raw));
}
