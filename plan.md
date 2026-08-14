# Tome — Plugin Architecture Implementation Plan

Decisions locked in `docs/adr/0001-plugin-architecture.md` and `docs/adr/0002-unified-read-routes.md`; vocabulary in `CONTEXT.md`. Do not re-litigate: the ADRs win. This plan is a refactor in Phases 1–2 (no behavior change), an extraction in Phase 3, documentation in Phase 4.

Verification gate after every phase: `bun run typecheck` must pass. Phases 1–2 also require a smoke test (below).

---

## Phase 0 — Domain model & ADRs ✅ DONE

`CONTEXT.md`, `docs/adr/0001-plugin-architecture.md`, `docs/adr/0002-unified-read-routes.md` written. Nothing else to do.

---

## Phase 1 — The source seam + unified `/read/` routes (this repo) ✅ DONE

**Goal:** routes and templates become source-agnostic. Sources become interchangeable adapters behind one registry. URLs move to `/read/:source/...` (ADR-0002). No behavior change: same data, same pages, new URLs.

### 1.1 Source registry — new `src/services/source-registry.ts`

Absorbs and deletes `src/services/sources.ts` (per-user flags move in; `SourceType` moves too).

Shape (sketch — the executing agent owns the exact types):

```ts
type SourceCapabilities = {
  search: boolean; follows: boolean; history: boolean; toplists: boolean;
  readLater: boolean; bookmarks: boolean; library: boolean; credentials: boolean;
};

interface Source {
  name: string;            // "royalroad" | "freewebnovel" | "epub" — appears in URLs
  displayName: string;
  capabilities: SourceCapabilities;
  // core trio:
  search?(query: string, userId?: string): Promise<Fiction[]>;
  getFiction(ref: string, userId?: string): Promise<Fiction | null>;
  getChapter(ref: string, chapterRef: string, userId?: string): Promise<ChapterContent | null>;
  // capability ops (only when the capability flag is set):
  getFollows?(userId: string): Promise<FollowedFiction[]>;
  getHistory?(userId: string): Promise<HistoryEntry[]>;
  getReadLater?(userId: string): Promise<Fiction[]>;
  getToplist?(toplist: ToplistType, userId?: string): Promise<Fiction[]>;
  setBookmark?(userId: string, fictionId: string, type: string, mark: boolean, csrf: string): Promise<{ success: boolean; error?: string }>;
  getLibrary?(userId: string): Promise<...[]>;
  addToLibrary?(...); removeFromLibrary?(...); updateProgress?(...);
  credentialFields?: CredentialField[];        // rendered by the settings page
  validateCredentials?(userId: string): Promise<boolean>;
  // escape hatch for source-specific pages core doesn't model:
  extraRoutes?: unknown[];
}

function registerSource(source: Source): void;
function getSource(userId: string | null, name: string): Source | null;  // null when unknown OR disabled for userId
function getEnabledSources(userId: string): Source[];
function setSourceEnabled(userId: string, name: string, enabled: boolean): void;
```

- `getSource` returns `null` when the user disabled the source — routes stop repeating `isSourceEnabled` checks (ADR-0001).
- Adapters stay in their current files (`scraper.ts`, `fwn-scraper.ts`, `epub.ts`, `fwn-library.ts`) and are wrapped as `Source` objects; no logic moves in Phase 1.
- Registration happens in one place (e.g. `src/sources.ts` at `src/` root, or in the registry module) — one array of `registerSource(...)` calls so Phase 3's plugin loading swaps that file for `TOME_PLUGINS` scanning.
- `epub.ts` becomes a source with capabilities `{ library: true, credentials: false, ... }`; its trio maps bookId → book metadata, chapterRef → reading position.

### 1.2 Unified routes — `src/routes/pages.ts` + `src/routes/api.ts`

Replace all per-source branches with registry calls, using the ADR-0002 table:

- `/read/:source` — source home
- `/read/:source/search`
- `/read/:source/:fictionRef` — fiction detail
- `/read/:source/:fictionRef/:chapterRef` — reader
- `/read/:source/:fictionRef/bookmark` (POST) — gated on `bookmarks` capability
- `/read/:source/library`, `/read/:source/follows`, `/history`, `/read-later`, `/toplists` — gated on the matching capability
- EPUB: `/read/epub/library`, `/read/epub/upload`, `/read/epub/:bookId`
- API: `/api/read/:source/:fictionRef/:chapterRef` (GET chapter JSON, POST progress), `/api/cover/:source/:ref`
- Legacy `/follows`, `/history`, `/read-later`, `/toplists` top-level paths redirect to `/read/<enabled-source-with-capability>/...` when exactly one enabled source has the capability; 404 otherwise.
- **Delete all legacy source paths** (`/chapter/*`, `/fiction/*`, `/fwn/*`, `/search`, `/library*`, `/epub/*`) — no redirects (ADR-0002).
- Delete the 13 `fwn*` aliased imports in `pages.ts` and the equivalent in `api.ts`.
- Delete the 4 duplicate `enabledSources` object spreads in `pages.ts` — one helper built from `getEnabledSources(userId)`.
- Remote control, invitations, auth, cache endpoints: untouched.

### 1.3 Unified templates — `src/templates/pages/`

- One fiction page, one reader page, one search page, one library page — parameterized by the `Source` object (display name, capabilities, ref formats are opaque).
- Delete: `fwn-fiction.tsx`, `fwn-reader.tsx`, `fwn-search.tsx`, `fwn-library.tsx`, plus now-unused per-source variants as the unified versions replace them (`fiction.tsx` → `fiction.tsx` kept, renamed props as needed).
- Capability-gated UI: bookmark buttons render from `capabilities.bookmarks`, library-add buttons from `capabilities.library`, stats from whatever the shared `Fiction` shape carries.
- `src/templates/components.tsx` nav: links driven by `getEnabledSources`, no hardcoded source names.
- Settings page: render one credentials form per enabled source with `credentialFields` (RoyalRoad keeps its cookie form via that mechanism); source toggles list from the registry.

### 1.4 Client JS — `public/js/reader.js`

- Unified URL scheme means one nav format; delete the `data-fwn-url` fallback and per-source attribute forks (`data-fiction-slug`, `data-chapter-num` vs `data-chapter-id`). Keep voice control and remote logic.

### Phase 1 stop condition

`bun run typecheck` passes; no `fwn` import or template file remains; every route in ADR-0002 resolves; old paths 404.

**Smoke test (manual, one pass):** start server, open RoyalRoad fiction → chapter → next/prev, FWN fiction → chapter, upload an EPUB, settings toggle each source off and confirm `/read/<source>` 404s, bookmark action works. Keep a real RR/FWN session cookie available for this.

---

## Phase 2 — Feature seam + remote control as reference feature (this repo) ✅ DONE

**Goal:** features become packages of routes/WS/migrations; remote control is the first, proving the interface.

- New `src/features/remote/` directory: `routes.ts` (the 4 `/api/remote/*` endpoints + `/remote/:token` page), `ws.ts` (upgrade handling, open/message/close from `src/index.ts`), `sessions.ts` (current `src/services/remote.ts`), `page.tsx` (current `templates/pages/remote.tsx`), `client.js` moved/re-imported from `reader.js` remote parts.
- New feature seam (sketch): `interface Feature { name: string; routes?: ...; apiRoutes?: ...; wsPaths?: ...; migrations?: ... }` with `registerFeature()`. `src/index.ts` shrinks to: app shell + iterate registered features for routes/WS paths.
- Move EPUB feature artifacts the same way (`src/features/epub/`): service, library/upload/reader templates, `epub-reader.js`, migrations.
- `TOME_PLUGINS` loading NOT yet wired (that's Phase 3); features register statically via the same registration file used by sources.

### Phase 2 stop condition

`bun run typecheck` passes; remote control and EPUB work exactly as before (same smoke test); `src/index.ts` contains no feature-specific logic except the registration list.

---

## Phase 3 — Package split & plugin loading (3 repos) ✅ DONE

**Goal:** core repo becomes scraper-free; sources install as npm packages.

- Create repos `tome-source-royalroad` and `tome-source-freewebnovel` (under the same GitHub org). Move: `scraper.ts` + `royalroad-credentials.ts` + `royalroad-auth.ts` + RR-specific template/credential bits → royalroad repo; `fwn-scraper.ts` + `fwn-library.ts` + FWN-specific bits → freewebnovel repo. Each exports a `Source` implementing the core interface, with its own README, license, tests.
- Core keeps: `epub` source (reference adapter), remote control, all seams. Delete moved files and their imports.
- Wire loading: read `TOME_PLUGINS` (comma-separated package names) in config; at startup `await import(name)` each and call `registerSource`/`registerFeature` on whatever it exports. Packages must be in `package.json` dependencies (document: `bun add <plugin>` + env var). Dockerfile: keep `bun add` lines per deployment choice.
- Publish core types so plugin repos typecheck against `@tome/core` (or a shared types package). At minimum: `Source`, `Feature`, `Fiction`, `Chapter`, `ChapterContent`, capability types.
- Core README: plugin index section listing available source packages (no scraper code, no scraper links in core repo itself — link out to the org).

### Phase 3 stop condition

Fresh clone of core + `bun add tome-source-royalroad` + `TOME_PLUGINS=tome-source-royalroad` boots, serves `/read/royalroad/...`, and `grep -r royalroad` finds nothing in core source except documentation.

---

## Phase 4 — Community surface ✅ DONE

- `docs/plugins.md`: authoring guide — how to implement a `Source` (contract, capabilities, ref semantics), how to implement a `Feature`, how to test against core types, publishing checklist.
- Example repo `tome-source-example` implementing a trivial source (static content) as the copy-paste starting point.
- Decide npm scope/organization and CI publish workflow (GitHub Actions → npm).
- Consider: `tome-source-x` (X/Twitter) as the first real community-style plugin, dogfooding the guide.

### Phase 4 stop condition

A fresh author can build a working source from `docs/plugins.md` + the example repo without reading core internals.

---

## Global rules for the executing session

- ADRs and CONTEXT.md are authoritative; if reality contradicts one, stop and surface it — don't silently deviate.
- Phases 1–2 are refactors: same data, same pages, new URLs. Don't add features while doing them.
- Each phase: run `bun run typecheck`, then the smoke test, then stop. Don't start the next phase in the same session unless the gate passed.
- Verify per AGENTS.md: check boundary/corner conditions (disabled source, unknown source name, capability-less source hitting a capability route, EPUB refs) — these are the failure-prone paths in this refactor.
