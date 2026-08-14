/**
 * Source registration (Phase 1)
 *
 * One file that registers every built-in source. Phase 3 replaces this file
 * with TOME_PLUGINS scanning: core keeps only the EPUB source and loads the
 * rest from npm packages.
 */
import { registerSource } from "./services/source-registry";
import { royalroadSource } from "./sources/royalroad";
import { freewebnovelSource } from "./sources/freewebnovel";
import { epubSource } from "./sources/epub";

registerSource(royalroadSource);
registerSource(freewebnovelSource);
registerSource(epubSource);
