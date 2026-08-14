/**
 * Tome - Web Fiction Proxy for E-ink Devices
 * Main entry point — app shell only. No feature-specific logic here (Phase 2):
 * sources and features register in ./registration; WS paths come from
 * registered features.
 */
import { PORT, ENABLE_BROWSER } from "./config";
import { handleRequest } from "./routes";
import { initBrowser, closeBrowser } from "./services/scraper";
import { startJobs, stopJobs } from "./services/jobs";
import { seedAdminUser } from "./lib/auth";
import { runMigrations } from "./lib/migrate";
import {
  getFeatures,
  type FeatureWsData,
  type FeatureWsPath,
} from "./services/feature-registry";
import type { ServerWebSocket } from "bun";
// Side-effect: register the built-in sources and features (Phase 3 replaces
// this with TOME_PLUGINS scanning). Must run before any request is handled.
import "./registration";

console.log("Starting Tome...");

// Run migrations first, then seed admin user
runMigrations();

seedAdminUser()
  .then(() => ENABLE_BROWSER ? initBrowser() : Promise.resolve())
  .then(() => {
    startJobs();
  })
  .catch(console.error);

/** The feature WS path handler that owns a connection, by its data payload. */
function wsPathFor(ws: ServerWebSocket<FeatureWsData>): FeatureWsPath | null {
  const feature = getFeatures()[ws.data.featureIndex];
  return feature?.wsPaths?.[ws.data.pathIndex] ?? null;
}

const server = Bun.serve<FeatureWsData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // Feature WebSocket paths (claimed before the HTTP router)
    for (const feature of getFeatures()) {
      for (const [pathIndex, wsPath] of (feature.wsPaths || []).entries()) {
        const params = wsPath.match(url.pathname, url);
        if (params === null) continue;
        const res = wsPath.upgrade(req, server, params);
        if (res) return res;
        return; // upgraded
      }
    }

    return handleRequest(req);
  },
  websocket: {
    open(ws) {
      wsPathFor(ws)?.open?.(ws, ws.data.params);
    },
    message(ws, message) {
      wsPathFor(ws)?.message?.(ws, message, ws.data.params);
    },
    close(ws, code, reason) {
      wsPathFor(ws)?.close?.(ws, code, reason, ws.data.params);
    },
  },
  idleTimeout: 120,
});

console.log(`Tome running at http://localhost:${server.port}`);
console.log("Press Ctrl+C to stop");

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  stopJobs();
  if (ENABLE_BROWSER) await closeBrowser();
  process.exit(0);
});
