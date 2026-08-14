# ADR-0001: Plugin architecture — sources and features as npm packages

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

Tome will be open-sourced. Two needs conflict with the current single-repo design:

1. **Legal isolation.** Scraping sources (RoyalRoad, FreeWebNovel) may not be legally redistributable inside the open-sourced core repository.
2. **Community extension.** Third parties must be able to add new sources (social feeds, other fiction sites) and new features without forking core.

Today all three sources (RoyalRoad, FreeWebNovel, EPUB) and cross-cutting features (remote control) are compiled into one repo, with duplicated per-source wiring: 13 aliased imports in `routes/pages.ts`, per-source route blocks in `pages.ts`/`api.ts`, `fwn-*` template twins, and a hand-maintained `SourceType` union.

## Decision

- **Core (`tome`)** contains: server, auth, invitations, settings, reading UI, EPUB source (the reference adapter), remote control (the reference feature), and the plugin seams. No scraper code.
- **Sources are plugins.** A source is an npm package exporting a source definition: name, display name, capabilities, the core trio (`search`, `getFiction`, `getChapter`), capability operations (`follows`, `history`, `toplists`, `read-later`, `bookmarks`, `library`, `credentials`), and optionally contributed pages for shapes core doesn't cover.
- **Features are plugins.** A feature exports routes, API routes, WebSocket paths, and migrations via the feature seam.
- **Plugins are compiled in at deploy time**, not dynamically loaded: installed as dependencies and listed in `TOME_PLUGINS` (comma-separated package names). Core imports them at startup. Install time is the load time for a self-hosted server; runtime hot-loading buys nothing.
- **Scraping sources live in separate repositories** (`tome-source-royalroad`, `tome-source-freewebnovel`), published to npm under the same org.
- **The per-user enable flags** move from `src/services/sources.ts` into the source registry; `sources.ts` is deleted. The registry's `get(userId, name)` returns the source or `null` when disabled — one guard instead of one per route block.
- **URLs are unified** under `/read/:source/...` (see ADR-0002).

## Consequences

- Core can be open-sourced with clean licensing; scraping plugins ship separately.
- Adding a source = one package + one `TOME_PLUGINS` entry; no core changes.
- Server restart required after changing plugins (accepted).
- Plugin authors depend on core-published types.
- Community sources needing pages beyond the generic shapes use the contributed-routes escape hatch instead of patching core.
