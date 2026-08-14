/**
 * Registration (Phase 3) — core sources/features are static; everything else
 * loads from TOME_PLUGINS npm packages. Each plugin exports a `source`
 * (Source) and/or `feature` (Feature); loadPlugins() is called by the app
 * shell before migrations so plugin migrations run too.
 */
import { registerSource } from "./services/source-registry";
import { registerFeature } from "./services/feature-registry";
import { TOME_PLUGINS } from "./config";
import { epubSource } from "./sources/epub";
import { epubFeature } from "./features/epub";
import { remoteFeature } from "./features/remote";
import { wsTestFeature } from "./features/ws-test";

registerSource(epubSource);
registerFeature(epubFeature);
registerFeature(remoteFeature);
registerFeature(wsTestFeature);

export async function loadPlugins(): Promise<void> {
  for (const name of TOME_PLUGINS) {
    console.log(`[Plugin] Loading ${name}...`);
    const mod = await import(name);
    if (mod.source) {
      registerSource(mod.source);
      console.log(`[Plugin] ${name}: source "${mod.source.name}" registered`);
    }
    if (mod.feature) {
      registerFeature(mod.feature);
      console.log(`[Plugin] ${name}: feature "${mod.feature.name}" registered`);
    }
  }
}
