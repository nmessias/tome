/**
 * WS diagnostic feature — /ws/test echo + report endpoint + test page.
 * (Was inline in src/index.ts and src/routes; extracted so the app shell
 * stays feature-free.)
 */
import type {
  FeatureRouteContext,
  FeatureWsData,
  FeatureWsPath,
  Feature,
} from "../../services/feature-registry";
import { getFeatureIndex } from "../../services/feature-registry";
import { WsTestPage } from "../../templates";

const wsPath: FeatureWsPath = {
  match(path) {
    return path === "/ws/test" ? {} : null;
  },
  upgrade(req, server) {
    const userAgent = req.headers.get("user-agent") || "unknown";
    const upgraded = server.upgrade(req, {
      data: {
        featureIndex: getFeatureIndex("ws-test"),
        pathIndex: 0,
        params: { userAgent, connectedAt: Date.now() },
      } as FeatureWsData,
    });
    return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
  },
  open(ws) {
    console.log("[WS-TEST] Connection opened");
    ws.send("connected");
  },
  message(ws, message) {
    const msg = String(message);
    ws.send(msg === "ping" ? "pong" : "echo:" + msg);
  },
  close() {
    console.log("[WS-TEST] Connection closed");
  },
};

async function pageRoutes(ctx: FeatureRouteContext): Promise<Response | null> {
  const { req, path, settings } = ctx;
  if (path === "/ws-test" && req.method === "GET") {
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    return new Response(WsTestPage({ settings, wsUrl: `${wsProtocol}://${host}/ws/test` }) as string, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return null;
}

async function apiRoutes(ctx: FeatureRouteContext): Promise<Response | null> {
  const { req, path } = ctx;
  if (path === "/api/ws-test/report" && req.method === "POST") {
    try {
      const report = await req.json();

      console.log("\n[WS-TEST] ═══════════════════════════════════════");
      console.log("[WS-TEST] DIAGNOSTIC REPORT");
      console.log("[WS-TEST] ═══════════════════════════════════════");
      console.log("[WS-TEST] User-Agent:", report.userAgent || "unknown");
      console.log("[WS-TEST] WebSocket API exists:", report.hasWebSocket);
      console.log("[WS-TEST] Connection attempted:", report.connectAttempted);
      console.log("[WS-TEST] Connection success:", report.connectSuccess);
      console.log("[WS-TEST] Message echo success:", report.messageSuccess);
      if (report.error) {
        console.log("[WS-TEST] Error:", report.error);
      }
      if (report.timing) {
        console.log("[WS-TEST] Connection time:", report.timing + "ms");
      }
      console.log("[WS-TEST] ═══════════════════════════════════════\n");

      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[WS-TEST] Failed to parse report:", e.message);
      return new Response(JSON.stringify({ error: "Invalid report format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return null;
}

export const wsTestFeature: Feature = {
  name: "ws-test",
  pageRoutes,
  apiRoutes,
  wsPaths: [wsPath],
};
