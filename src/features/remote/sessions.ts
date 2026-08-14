import QRCode from "qrcode";
import type { ServerWebSocket } from "bun";

export type RemoteClientRole = "reader" | "controller";

export type RemoteWsData = {
  token: string;
  role: RemoteClientRole;
  connectedAt: number;
};

type RemoteSession = {
  token: string;
  createdAt: number;
  readers: Set<ServerWebSocket<RemoteWsData>>;
  controllers: Set<ServerWebSocket<RemoteWsData>>;
};

const tokenToSession = new Map<string, RemoteSession>();

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function createRemoteSession(): string {
  const token = generateToken();
  
  tokenToSession.set(token, {
    token,
    createdAt: Date.now(),
    readers: new Set(),
    controllers: new Set(),
  });
  
  return token;
}

export function isValidToken(token: string): boolean {
  return tokenToSession.has(token);
}

export function getSession(token: string): RemoteSession | undefined {
  return tokenToSession.get(token);
}

export function invalidateToken(token: string): void {
  const session = tokenToSession.get(token);
  if (session) {
    for (const ws of session.readers) {
      try { ws.close(1000, "Session invalidated"); } catch {}
    }
    for (const ws of session.controllers) {
      try { ws.close(1000, "Session invalidated"); } catch {}
    }
    tokenToSession.delete(token);
  }
}

export function registerClient(
  ws: ServerWebSocket<RemoteWsData>,
  token: string,
  role: RemoteClientRole
): boolean {
  const session = tokenToSession.get(token);
  if (!session) return false;
  
  if (role === "reader") {
    session.readers.add(ws);
    notifyControllers(session, { type: "reader_connected" });
  } else {
    session.controllers.add(ws);
    notifyReaders(session, { type: "controller_joined" });
  }
  
  return true;
}

export function unregisterClient(ws: ServerWebSocket<RemoteWsData>): void {
  const session = tokenToSession.get(ws.data.token);
  if (!session) return;
  
  if (ws.data.role === "reader") {
    session.readers.delete(ws);
    notifyControllers(session, { type: "reader_disconnected" });
  } else {
    session.controllers.delete(ws);
    notifyReaders(session, { type: "controller_left" });
  }
}

export function broadcastToReaders(token: string, message: object): void {
  const session = tokenToSession.get(token);
  if (!session) return;
  notifyReaders(session, message);
}

function notifyReaders(session: RemoteSession, message: object): void {
  const json = JSON.stringify(message);
  for (const ws of session.readers) {
    try { ws.send(json); } catch {}
  }
}

function notifyControllers(session: RemoteSession, message: object): void {
  const json = JSON.stringify(message);
  for (const ws of session.controllers) {
    try { ws.send(json); } catch {}
  }
}

export async function generateQRCode(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 200,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
