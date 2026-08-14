# ADR-0002: Unified read routes

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

RoyalRoad and FreeWebNovel used distinct URL shapes (`/chapter/:id` vs `/fwn/chapter/:slug/:chapterSlug`), with duplicated route blocks, template twins, and client-side fallbacks (`data-fwn-url`). With sources as plugins (ADR-0001), core routes cannot know per-source URL shapes.

## Decision

One source-agnostic namespace:

| Purpose | Route |
|---|---|
| Source home | `/read/:source` |
| Search | `/read/:source/search` |
| Fiction detail | `/read/:source/:fictionRef` |
| Chapter reader | `/read/:source/:fictionRef/:chapterRef` |
| Bookmark action (POST) | `/read/:source/:fictionRef/bookmark` |
| Library (capability-gated) | `/read/:source/library` |
| Capability pages (follows, history, read-later, toplists) | `/read/:source/follows` etc. — capability-gated; legacy top-level paths redirect to the enabled source with that capability |
| Chapter JSON API | `/api/read/:source/:fictionRef/:chapterRef` |
| Cover proxy | `/api/cover/:source/:ref` |
| EPUB (core source) | `/read/epub/library`, `/read/epub/upload`, `/read/epub/:bookId` |

- `:source` is the registered source name; `:fictionRef`/`:chapterRef` are opaque strings interpreted only by the owning adapter (number for RoyalRoad, slug for FreeWebNovel, bookId for EPUB).
- Legacy paths (`/chapter/*`, `/fiction/*`, `/fwn/*`) are dropped without redirects — single-user project, bookmarks are re-created.

## Consequences

- Core routes and templates are fully source-agnostic; the `fwn-*` template twins are deleted.
- Client-side per-source navigation hacks (`data-fwn-url` fallback) are deleted.
- When two sources share a capability, the source prefix in the URL removes ambiguity.
