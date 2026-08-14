/**
 * Tome - Web Fiction Proxy for E-ink Devices
 * Main entry point
 */
import { PORT, ENABLE_BROWSER } from "./config";
import { handleRequest } from "./routes";
import { initBrowser, closeBrowser } from "./services/scraper";
import { startJobs, stopJobs } from "./services/jobs";
import { seedAdminUser } from "./lib/auth";
import { runMigrations } from "./lib/migrate";
// Side-effect: register the built-in sources (Phase 3 replaces this with
// TOME_PLUGINS scanning). Must run before any request is handled.
import "./sources";
import {
  isValidToken,
  registerClient,
  unregisterClient,
  broadcastToReaders,
  type RemoteWsData,
  type RemoteClientRole,
} from "./services/remote";

console.log("Starting Tome...");

// Run migrations first, then seed admin user
runMigrations();

seedAdminUser()
  .then(() => ENABLE_BROWSER ? initBrowser() : Promise.resolve())
  .then(() => {
    startJobs();
  })
  .catch(console.error);

type WsData = 
  | { type: "test"; connectedAt: number; userAgent: string }
  | { type: "remote"; token: string; role: RemoteClientRole; connectedAt: number };

const server = Bun.serve<WsData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    
    if (url.pathname === "/ws/test") {
      const userAgent = req.headers.get("user-agent") || "unknown";
      const upgraded = server.upgrade(req, {
        data: { type: "test" as const, connectedAt: Date.now(), userAgent },
      });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
    
    const remoteMatch = url.pathname.match(/^\/ws\/remote\/([a-z0-9]+)$/);
    if (remoteMatch) {
      const token = remoteMatch[1];
      const role = url.searchParams.get("role") as RemoteClientRole;
      
      if (!role || (role !== "reader" && role !== "controller")) {
        return new Response("Missing or invalid role parameter", { status: 400 });
      }
      
      if (!isValidToken(token)) {
        return new Response("Invalid token", { status: 404 });
      }
      
      const upgraded = server.upgrade(req, {
        data: { type: "remote" as const, token, role, connectedAt: Date.now() },
      });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
    
    return handleRequest(req);
  },
  websocket: {
    open(ws) {
      if (ws.data.type === "test") {
        console.log("[WS-TEST] Connection opened");
        ws.send("connected");
        return;
      }
      
      if (ws.data.type === "remote") {
        const { token, role } = ws.data;
        const registered = registerClient(ws as any, token, role);
        if (!registered) {
          ws.close(1008, "Invalid session");
          return;
        }
        console.log(`[REMOTE] ${role} connected to session ${token.slice(0, 6)}...`);
        ws.send(JSON.stringify({ type: "connected", role }));
      }
    },
    message(ws, message) {
      if (ws.data.type === "test") {
        const msg = String(message);
        if (msg === "ping") {
          ws.send("pong");
        } else {
          ws.send("echo:" + msg);
        }
        return;
      }
      
      if (ws.data.type === "remote" && ws.data.role === "controller") {
        try {
          const data = JSON.parse(String(message));
          if (data.action === "next" || data.action === "prev") {
            broadcastToReaders(ws.data.token, { action: data.action });
          }
        } catch {}
      }
    },
    close(ws, code, reason) {
      if (ws.data.type === "test") {
        console.log("[WS-TEST] Connection closed");
        return;
      }
      
      if (ws.data.type === "remote") {
        unregisterClient(ws as any);
        console.log(`[REMOTE] ${ws.data.role} disconnected from session ${ws.data.token.slice(0, 6)}...`);
      }
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
