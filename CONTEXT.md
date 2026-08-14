# Tome — Domain Model

Self-hosted web fiction reader optimized for e-ink devices (Kindle/Kobo). Bun server, SQLite, server-rendered HTML.

## Domain terms

- **Source** — a plugin that provides reading content. Registered by name in the source registry; names appear in URLs (`/read/:source/...`). Current sources: RoyalRoad, FreeWebNovel, EPUB. Future/community sources can be anything (e.g. X/Twitter feeds).
- **Core** — the base Tome app: server, auth, invitations, settings, reading UI, EPUB source, remote control, and the plugin seams. Contains no scraper code.
- **Plugin** — an npm package exporting sources and/or features. Installed as a dependency, activated via the `TOME_PLUGINS` env var. Loaded at startup (compiled in), not at runtime.
- **Capability** — an optional source feature: `search`, `follows`, `history`, `toplists`, `read-later`, `bookmarks`, `library`, `credentials`. Core UI renders capability-gated pages/buttons from these flags, never from source names.
- **Fiction** — a reading item (RoyalRoad fiction, FreeWebNovel novel, EPUB book).
- **Chapter** — a reading unit. `ChapterContent` = renderable text plus prev/next navigation.
- **Ref** — an opaque per-source identifier for a fiction or chapter (numeric id for RoyalRoad, slug for FreeWebNovel, bookId for EPUB). Only the owning source interprets refs; core treats them as strings.
- **Reader** — the chapter reading page: e-ink paginated SPA, shared by all sources.
- **Library** — a per-source local collection (EPUB files; FreeWebNovel saved novels).
- **Feature** — a cross-cutting plugin contributing routes, API routes, WebSocket paths, or migrations. Remote control is the reference feature (ships in core).
- **Remote session** — a token-scoped WebSocket session pairing one reader (the e-ink device) with one or more controllers (phones). Supports next/prev commands and voice control.

## Architecture invariants

- Core routes are source-agnostic: they call the source registry, never a source package directly (ADR-0001).
- Sources return the shared `Fiction`/`Chapter`/`ChapterContent` types (`src/types.ts`).
- All reading URLs live in one namespace: `/read/:source/...` (ADR-0002).
- Scraping sources live outside the core repo (legal isolation, ADR-0001).
