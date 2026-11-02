# Agent notes

Things that are not obvious from the code. Domain model: `CONTEXT.md`.

## Devices

Every page renders on three devices; the Kindle Paperwhite is the main one.

- Kindle gets `body.kindle` (set server-side). Its browser needs ES5 JS (no
  arrow functions, `const`, optional chaining). No hover, so links must look
  tappable. Every navigation is a full e-ink refresh, so fewer page hops beat
  prettier pages. Avoid animation, gray fills and dimmed overlays (they dither).
  Tap targets need about 40px.
- Android phone: under 480px wide. Desktop: content capped at 900px.
- Check UI changes at all three widths before shipping (Playwright screenshots
  of the rendered templates at 758, 390 and 1280px are enough; the reader needs
  `/public` served on the same origin because it paginates in JS).

## Deploy

- Pushing `main` deploys to Fly app `tome-in` (`.github/workflows/fly.yml`).
- Static assets are cache-busted with `ASSET_VERSION` (`src/config.ts`), set per
  process start. Do not reintroduce a hand-bumped version: it was forgotten and
  devices kept a stale stylesheet against new HTML.

## Royal Road plugin

- Lives in its own repo (local clone `~/tome-source-royalroad`), pinned by
  commit in `package.json` (`tome-source-royalroad#<sha>`). Ship a plugin
  change by pushing the plugin, then bumping the pin here with `bun install`.
- Adding a `Source` method: add it to the interface here as optional and push
  first, then the plugin, then the pin bump. The plugin pins core for types too,
  but bumping that pin currently fails (`tome-source-asura` does not resolve),
  so core's `bun run typecheck` is the authoritative check.
- Scraped lists are cached in SQLite (`follows:`, `readlater:`, `toplist:`
  keys, plus stale copies served when Royal Road is unreachable). After a
  parser change, clear them at `/cache` or the old parse is served until TTL.

### Royal Road markup (as of 2026-11)

- Logged-in pages (follows, read later, and toplists/search when fetched with a
  session) use expanded cards `[data-rr-expanded-fic-card]`. Stats are
  value-then-label siblings, the description is `.prose`, tags are `tagsAdd`
  links. Anonymous toplists still use legacy `.fiction-list-item`.
- The follows unread marker is a "New Chapters!" badge. Core also treats
  latest-chapter != last-read as new (`hasNewChapters`), since the badge markup
  has drifted before.
- The scraper blocks images. They must be answered with a blank GIF, not
  aborted: an aborted cover fires Royal Road's inline `onerror`, which swaps
  `src` to the "400 x 600" placeholder before the HTML is read.
- To see current markup, log in locally with the `.env` credentials in headed
  Chromium under `xvfb-run` and save `page.content()` after `page.goto`.
  `page.request` gets Cloudflare 403s.

## Working alongside other sessions

Other agent sessions often edit these repos concurrently (check `git status`
and `plans/`). Stage explicit paths, never `git add -A`, and leave files you did
not change alone.
