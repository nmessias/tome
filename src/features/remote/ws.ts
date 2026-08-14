/**
 * Remote control feature — WebSocket path (upgrade/open/message/close).
 */
import type {
  FeatureWsData,
  FeatureWsPath,
} from "../../services/feature-registry";
import { getFeatureIndex } from "../../services/feature-registry";
import {
  registerClient,
  unregisterClient,
  broadcastToReaders,
  type RemoteClientRole,
} from "./sessions";

export const remoteWsPath: FeatureWsPath = {
  match(path, url) {
    const m = path.match(/^\/ws\/remote\/([a-z0-9]+)$/);
    if (!m) return null;
    const role = url.searchParams.get("role") as RemoteClientRole | null;
    return { token: m[1], role };
  },
  upgrade(req, server, params) {
    const { token, role } = params as { token: string; role: RemoteClientRole | null };

    if (!role || (role !== "reader" && role !== "controller")) {
      return new Response("Missing or invalid role parameter", { status: 400 });
    }

    const upgraded = server.upgrade(req, {
      data: {
        featureIndex: getFeatureIndex("remote"),
        pathIndex: 0,
        params: { token, role, connectedAt: Date.now() },
      } as FeatureWsData,
    });
    return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
  },
  open(ws, params) {
    const { token, role } = params as { token: string; role: RemoteClientRole };
    const registered = registerClient(ws as any, token, role);
    if (!registered) {
      ws.close(1008, "Invalid session");
      return;
    }
    console.log(`[REMOTE] ${role} connected to session ${token.slice(0, 6)}...`);
    ws.send(JSON.stringify({ type: "connected", role }));
  },
  message(ws, message, params) {
    const { token, role } = params as { token: string; role: RemoteClientRole };
    if (role !== "controller") return;
    try {
      const data = JSON.parse(String(message));
      if (data.action === "next" || data.action === "prev") {
        broadcastToReaders(token, { action: data.action });
      }
    } catch {}
  },
  close(ws, _code, _reason, params) {
    const { role } = params as { role: RemoteClientRole };
    unregisterClient(ws as any);
    console.log(`[REMOTE] ${role} disconnected from session ${(params as any).token.slice(0, 6)}...`);
  },
};
