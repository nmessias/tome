/**
 * Static registration (Phase 2) — sources + features.
 *
 * Phase 3 replaces this file with TOME_PLUGINS scanning: core keeps only the
 * EPUB source and loads the rest from npm packages. Must be imported once by
 * the app shell (src/index.ts) for its side effects.
 */
import { registerSource } from "./services/source-registry";
import { registerFeature } from "./services/feature-registry";
import { royalroadSource } from "./sources/royalroad";
import { freewebnovelSource } from "./sources/freewebnovel";
import { epubSource } from "./sources/epub";
import { remoteFeature } from "./features/remote";
import { epubFeature } from "./features/epub";
import { wsTestFeature } from "./features/ws-test";

registerSource(royalroadSource);
registerSource(freewebnovelSource);
registerSource(epubSource);

registerFeature(remoteFeature);
registerFeature(epubFeature);
registerFeature(wsTestFeature);
