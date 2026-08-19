# Perf review — long reads of big RR chapters on Kindle e-ink

Scope: reading 13k-word RR chapters (~95KB HTML, ~150 CSS-multicol pages at large
e-ink fonts) for long sessions on a Kindle experimental browser (weak CPU, small
heap, slow Wi-Fi). Read-only; nothing modified. Baseline = the just-shipped LRU
cache fix (`rememberChapter`/`touchChapter`, `APP_VERSION` 1.5.1, reader.js
`S.cache` capped at 5) which is verified in place and correct.

Ranked by impact-for-effort. Every finding is read-backed with exact line
numbers. The line numbers under `node_modules/tome-source-royalroad` refer to
the plugin repo (a git dep), not core.

---

## P0 — the RR chapter cache is never read on the live path; every chapter read re-scrapes Royal Road (≈3 scrapes per chapter turn)

**Location:**
- `node_modules/tome-source-royalroad/src/scraper.ts:1234-1249` — the cache-read
  gate. `isPreCaching = ttl !== undefined` (1236); the `getCache(cacheKey)`
  read (1238-1243) only happens when pre-caching; the live path falls straight
  into `getPage(...)` (1245-1249), i.e. a fresh HTTP scrape of
  `royalroad.com/fiction/0/chapter/...`.
- `node_modules/tome-source-royalroad/src/scraper.ts:1460` — `setCache(..., CACHE_TTL.CHAPTER)`:
  the cache is **write-only** for live reads. Every live read re-scrapes and
  re-writes a ~100KB row.
- Callers that exercise the live path: `src/routes/pages.ts:609-625` (SSR reader
  route → `source.getChapter`, no ttl) and `src/routes/api.ts:33` (GET
  `/api/read/...` → same). `getFiction`/`getFollows`/`getToplist` all read the
  cache first; `getChapter` is the odd one out — this is the leak in the cache
  design.

**What happens per chapter turn (counted end-to-end), on top of the client LRU:**
1. `preloadChapters()` (reader.js:569) GETs `/api/read/<next>` → live scrape #1.
   Inside that scrape, `scraper.ts:1475-1482` schedules a server-side pre-cache
   of next-next (anon, `ttl` set) → scrape #2 if not already warm.
2. `reportProgress()` (reader.js:589) POSTs `/api/read/<current>` → RR source
   `updateProgress` →
   `await getChapter(id, userId)` with **no ttl** (`source.ts:117-120`) → live
   scrape #3 of the chapter the reader is currently sitting on — that's the
   RR "mark as read" mechanism, so this one is semantically needed, but it still
   does the full scrape+parse+rewrite.
3. Every one of these live GETs also invalidates the shared `fiction:` and
   `follows:` caches (`scraper.ts:1462-1471`), so the follows page re-scrapes RR
   on every visit during a long read.

**Why it hurts on Kindle:** every chapter boundary depends on an upstream live
round-trip + full server-side linkedom parse + multi-hundred-node DOM cleanup
(`scraper.ts:1340-1434`). During a 50-chapter session that's ~150 upstream hits
(the POST "mark read" alone doubles it), Cloudflare/rate-limit exposure, and it
silently defeats the 30-day SQLite cache and the background warm job (jobs.ts)
that pre-caches the next chapter with `ttl` — the warm cache is never consulted
by the reader. Backtracking past the LRU window (which evicts after 5 chapters)
turns a flip into a multi-second network stall.

**Minimal fix (plugin):** read `getCache(cacheKey)` on the live path too —
scrape only on miss; skip the fiction/follows invalidation and next-chapter
pre-cache on a cache hit (those are side effects of an actual upstream read).
Keep the authenticated re-scrape on the POST progress path for mark-as-read.
Chapter GETs drop from a remote scrape + parse to a local SQLite string read.

**Effort: S.** Payoff: largest single win — removes per-flip upstream latency
and upstream load, and makes the existing cache + warm job actually function.

---

## P1 — no response compression anywhere; every payload ships raw

**Location:** `src/server.ts:11` (`html`), `:23` (`json`), `:106` (`serveStatic`).
No `Content-Encoding` on any response; no `Vary: Accept-Encoding`.

**What happens:** the SSR reader page (~95KB inline chapter + CSS/JS), the
`/api/read` JSON (~100KB of escaped HTML), reader.css, reader.js — all
uncompressed over the wire.

**Why it hurts:** Kindle Wi-Fi is the binding constraint, and prose HTML/JSON is
~70-75% compressible — a 95KB chapter page becomes ~25-30KB. This multiplies
across every SSR load and every preload XHR. Kindle experimental WebKit
negotiates gzip fine.

**Minimal fix:** one small helper — `Bun.gzipSync` for `text/*` and
`application/json` when the client sends `Accept-Encoding: gzip`, with
`Vary: Accept-Encoding` (skip binary/image bodies). Wire into `html`/`json`/`serveStatic`.
**Effort: S/M.** Benefits every route, not just the reader.

---

## P1 — preloadChapters fetches prev+next (2 full chapters) on every render and at first load

**Location:** `public/js/reader.js:569-576` (`preloadChapters`), called at
`:615` (in `renderChapter`) and twice in `init` (`:830`, `:856`).

**What happens:** every rendered chapter issues **two** parallel full-chapter
XHRs (~95KB each) whenever a neighbour isn't in the LRU. The very first page
load runs it too — before the 150-column layout has even painted. The `prev`
fetch is usually redundant right after a forward flip (the chapter you came from
is already in the LRU, just being re-touched), and it churns the LRU window
(pushing real chapters toward eviction). When you jump into the middle of a book
from the index, both neighbours are fetched at once → ~190KB racing the first
layout.

**Why it hurts:** ~190KB of Kindle Wi-Fi traffic + 2 server round-trips per
chapter nav (each a fresh scrape under P0); first-load jank; battery.

**Minimal fix:** preload **only `nextRef`** (skip `prevRef`; the fallback in
`navigateToChapter` — full page load — already handles a missing prev at
reader.js:623-628). Defer the `init()` preload until after first paint (`ready`
rAF, around `:843-850`) or until the first page turn into the last page.
**Effort: S.**

---

## P1 — manual fake-flash "e-ink refresh" on every chapter boundary

**Location:** `public/js/reader.js:452-464` (`triggerEinkRefresh`), called at
`:475` (nextPage edge) and `:500` (prevPage edge).

**What happens:** crossing a chapter edge paints `body` background black for
100ms, white for 100ms, then waits another 100ms before rendering the new
chapter — a ~300ms full-screen flicker inserted before every chapter flip. It's
unconditional (not gated on Kindle) and hard-codes white, flashing the wrong
color in dark/sepia themes.

**Why it hurts:** on real e-ink, a synthetic solid-black-then-white frame is a
guaranteed ghosting/flicker wave — the device controller already does a full
refresh at flip; this fake frame fights it and adds perceived latency + two full
repaints per chapter.

**Minimal fix:** delete it (let the device's native refresh handle e-ink), or
gate behind `body.kindle` + the theme's true background. **Effort: S.**

---

## P2 — resize handler re-runs the full 150-column pagination even when width didn't change

**Location:** `public/js/reader.js:378-403` (`updatePages`), `:779-795`
(`window.onresize`, debounced 150ms).

**What happens:** `updatePages()` forces layout three times on any geometry
change: `offsetWidth` read (:380) → three inline style writes (width/columnWidth/
columnGap, :391-393) → full-fragment `scrollWidth` read (:396). The resize
handler fires this on *any* viewport change — including 1px shifts from the
KUAL/experimental-browser chrome. A horizontal-scrollbar appearing/disappearing
can flip the width by a couple of px and repaginate a stable 150-column layout
for no reason (the `?p=` position then snaps because totalPages rounding moved).

**Why it hurts:** multicol fragmentation over 13k words is the single most
expensive layout the page performs on the weak e-ink CPU; re-running it for a
pixel shift is pure waste and janks the next page flip.

**Minimal fix:** remember the last paginated `columnWidth` (+ viewport width) and
skip `updatePages()` when unchanged (the debounce is already there; this makes
it exact). **Effort: S.**

---

## P2 — scroll listener accumulation in applyMode (same leak class as the cache fix)

**Location:** `public/js/reader.js:355` (inside `applyMode`) and `:800` (inside
`attachHandlers`).

**What happens:** every time mode is toggled to scrolled, a new **anonymous**
scroll listener is appended and never removed; `attachHandlers` adds yet another
at init when desktop/scrolled. Each scroll event then runs
`updateDesktopProgress()` N times, and each call reads `scrollTop` +
page's `scrollHeight` (reader.js:165-171) → forced layout per scroll, N times.

**Why it hurts:** exactly the unbounded-growth pattern the LRU fix just removed,
still present in a different spot — weak-CPU e-ink degrades gracefully with every
mode toggle over a long session.

**Minimal fix:** register one named handler once in `attachHandlers` and make
`updateDesktopProgress`/the handler no-op when not scrolled/desktop (or
`removeEventListener` the named fn in `applyMode` before re-adding).
**Effort: S.**

---

## P2 — renderChapter: giant innerHTML + arbitrary 100ms sleep + no paint gate

**Location:** `public/js/reader.js:597-598` (`S.els.content.innerHTML = chapter.content`),
`:614` (`setTimeout(..., 100)` → `updatePages`), `:524-526` (the `.ready`
visibility gate is only applied at init, `:843-850`, not per render).

**What happens:** each chapter nav parses ~95KB of HTML into the live DOM (a few
thousand nodes), then waits a hard-coded 100ms, then forces the full multicol
layout. Unlike first paint, `renderChapter` never drops the `.ready` class, so
the partially-laid-out multicol block (old geometry, new content) is visible
during that window → the Kindle repaints the whole fragment 2-3 times per
chapter flip.

**Why it hurts:** doubles the visible repaint/flash cost of every chapter flip on
a device where each repaint is a full e-ink refresh; the 100ms is dead latency.

**Minimal fix:** around the swap, remove `ready` → `innerHTML` → `updatePages` →
re-add `ready`, so the intermediate un-laid-out state stays hidden (mirror the
init pattern at `:843-850`); keep the short delay if font metrics need to settle,
but don't paint the intermediate frame. **Effort: S/M.**

---

## P2 — pushState per chapter builds an unbounded history stack

**Location:** `public/js/reader.js:638-642` (`navigateToChapter` → `pushState`
per chapter), `:415-423` (`replaceState` for page, debounced 500ms).

**What happens:** every chapter nav pushes a history entry (state + URL). During
a long session that's one entry per chapter. Two consequences: (a) back button
walks every chapter read — N presses to actually leave the book (and popstate
then re-renders each from cache or full-loads, `:653-671`); (b) in small-heap
WebKit, each pushed entry can keep the previous chapter's render alive for
back/forward, compounding heap pressure across a session (this is engine-
dependent and speculative for Kindle WebKit, but the entries themselves are
pointless here because content is already re-rendered in place).

**Minimal fix:** use `replaceState` for chapter nav too (drop the redundant
replace that immediately follows within 500ms via `scheduleUrlUpdate`
— goToPageFast → scheduleUrlUpdate, `:604-616`). History-dive-back as a feature
is out of scope. **Effort: S.**

---

## P3 — animated progress bar repaints on every page flip

**Location:** `public/css/reader.css:527` (`transition: width 0.1s linear`),
driven per flip by `updateProgressBar`/`updateIndicator` (reader.js:405-408).

**What happens:** every page turn rewrites `.progress-bar` width; the 0.1s
transition animates it with intermediate frames.

**Why it hurts:** e-ink can't animate smoothly — ~150 animated repaints per
chapter on a device that treats each as a refresh.

**Minimal fix:** `body.kindle .progress-bar { transition: none; }` (the
`body.kindle` class already exists, reader.css:49, set from UA in
`src/routes/index.ts:67`). **Effort: S.**

---

## P3 — webfont swap causes a second full pagination after first paint

**Location:** `public/css/reader.css:6-29` (three `@font-face` Literata rules,
`font-display: swap`); fonts served from `public/fonts/` (1-year cache,
server.ts:86).

**What happens:** the 150-column layout is first computed with the fallback
metrics (`font-family: "Bookerly", 'Literata', Georgia, serif`;
reader.css:168, and the local/fallback one actually present at load). When the
Literata woff2s land (they're small subsetted files, ~8KB each, plus 950KB
variable ttfs behind them), the font swaps in, metrics differ, and the multicol
fragment re-fragments a second time after the reader has already paginated.

**Why it hurts:** a duplicate ~150-column fragmentation pass plus a visible
reflow/ghost on e-ink, mid-chapter on slow Wi-Fi.

**Minimal fix:** `font-display: optional` (render with the fallback and never
swap), or only load Literata on non-Kindle devices (Kindle already has Bookerly
installed, listed first). **Effort: S.**

---

## P3 — SQLite cache rows are never auto-pruned; the file grows and never shrinks

**Location:** `src/services/cache.ts:82` (`clearExpiredCache`), wired only
to the manual settings route `src/routes/pages.ts:262`. No startup/scheduled
prune anywhere (verified: the settings route is the only caller outside the
service).

**What happens:** `cache` rows expire by TTL (30 days for chapters) but nothing
deletes them except a manual "Clear expired" click. Current `data/sessions.db`
is ~29MB on disk with ~5.4MB of live `cache` content (295 rows) — the rest is
freelist pages (SQLite never shrinks on delete without VACUUM), so the file only
grows as distinct chapters/fictions accumulate.

**Why it hurts:** long-running instance (Fly, docker-compose) steadily accrues
disk and slows index scans; negligible for the Kindle client itself.

**Minimal fix:** run `clearExpiredCache()` on a `setInterval` at startup
(alongside the existing jobs in `src/index.ts`), plus periodic `VACUUM` is
optional. **Effort: S.**

---

## Re: the "double transfer" question (SSR inlines content, API re-sends it)

- The SSR reader page inlines the **current** chapter (`src/templates/pages/reader.tsx:72-74`),
  and the client fetches only **neighbouring** chapters via `/api/read` JSON
  (`api.ts:38` re-serializes `content` into JSON — escaping inflates it a few
  percent). So on a straight forward read, each chapter's HTML is transferred
  exactly once; the "double" only appears on **revisits** — a chapter is sent as
  SSR first, then re-sent as JSON when you backtrack past... and the LRU means
  several back-flips inside the window are still free. So the double-transfer is
  real only on: (a) first back-flip (the current chapter re-GETs), and (b) any
  backtrack beyond the 5-chapter LRU window.
- Cheapest mitigation order: **P1 gzip** (fixes the transfer *size* everywhere),
  **P0 cache-first** (fixes the *scrape + latency* on every revisit), and a tiny
  bonus — seed `S.cache[S.chapterRef]` from the already-rendered
  `S.els.content.innerHTML` at `init` so the very first back-flip is local
  (reader.js:670, `cacheElements`/`init`; the content is already in the DOM,
  serialization is linear). No API-shape change needed.

---

## Checked and fine (no action)

- **`S.cache` LRU** (reader.js:522-543): capped at 5, correct; `rememberChapter`
  evicts oldest, `touchChapter` reorders. Target fix is in place.
- **Page-turn path** (`goToPageFast` :441 → `scrollLeft` write + indicator text +
  debounced `replaceState`): no layout read per turn, no timers accumulated —
  the turn itself is cheap. Good.
- **`fetchChapter`/XHR**: single-response, no interval, cleaned up by GC after
  `JSON.parse`; the parsed object is what the LRU holds (bounded).
- **rr chapter images**: none — scraper blocks them (`BLOCKED_RESOURCE_TYPES`,
  scraper.ts:19); covers are separately cached (`/api/cover` + image_cache,
  api.ts:48-104). Not a payload factor on the reader.
- **Static caching**: 1-day asset cache + `?v=${APP_VERSION}` busting correct
  (layout.tsx:37-38, 125-126; server.ts:84). The 1.5.1 JS/CSS will be fetched
  fresh.
- **EPUB reader** (`epub-reader.js`) is a separate, source-specific path — out of
  scope for the RR scenario; not reviewed here.
- **`updatePages` on genuine font/line-height/width changes** necessarily
  re-paginates (geometry really changed) — correct behavior; only the
  unchanged-width resize path (P2) is waste.

---

## Top 3 wins

1. **Cache-first live chapter reads in the RR plugin** (`scraper.ts:1234`) — a
   one-line gate change turns every chapter boundary from up to 3 live upstream
   scrapes into a local SQLite hit. Removes per-flip latency, upstream load,
   rate-limit risk, and makes the existing 30-day cache + warm job effective.
   S-effort, highest payoff.
2. **Compress all text responses** (`server.ts` `html`/`json`/`serveStatic`) —
   ~70% off the 95KB chapter page and every JSON fetch. The single biggest
   wire-byte win on Kindle Wi-Fi; one helper, benefits every route. S/M.
3. **Preload only `next`, deferred after first paint** (`reader.js:569`) —
   halves per-chapter payload on jumps (190KB→95KB) and removes the first-load
   fetch race against the 150-column layout. S-effort, direct Kindle-feel win
   now that the LRU is bounded.
