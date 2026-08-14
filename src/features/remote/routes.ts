/**
 * Remote control feature — page + API routes (moved from src/routes/).
 */
import type { FeatureRouteContext } from "../../services/feature-registry";
import { ErrorPage } from "../../templates";
import { RemotePage } from "./page";
import { createRemoteSession, isValidToken, invalidateToken, generateQRCode } from "./sessions";

export async function remotePageRoutes(ctx: FeatureRouteContext): Promise<Response | null> {
  const { req, path, settings } = ctx;
  const method = req.method;

  const remoteMatch = path.match(/^\/remote\/([a-z0-9]+)$/);
  if (remoteMatch && method === "GET") {
    const token = remoteMatch[1];

    if (!isValidToken(token)) {
      return new Response(
        ErrorPage({
          title: "Invalid Session",
          message: "This remote control session has expired or is invalid.",
          settings,
        }) as string,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${host}/ws/remote/${token}?role=controller`;

    return new Response(RemotePage({ token, wsUrl }) as string, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return null;
}

export async function remoteApiRoutes(ctx: FeatureRouteContext): Promise<Response | null> {
  const { req, path } = ctx;
  const method = req.method;

  if (path === "/api/remote/create" && method === "POST") {
    const token = createRemoteSession();
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";

    return new Response(
      JSON.stringify({
        token,
        remoteUrl: `${protocol}://${host}/remote/${token}`,
        qrUrl: `/api/remote/qr/${token}`,
        wsUrl: `${protocol === "https" ? "wss" : "ws"}://${host}/ws/remote/${token}`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const qrMatch = path.match(/^\/api\/remote\/qr\/([a-z0-9]+)$/);
  if (qrMatch && method === "GET") {
    const token = qrMatch[1];

    if (!isValidToken(token)) {
      return new Response("Invalid token", { status: 404 });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const remoteUrl = `${protocol}://${host}/remote/${token}`;

    try {
      const qrBuffer = await generateQRCode(remoteUrl);
      return new Response(new Uint8Array(qrBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    } catch (e: any) {
      console.error("[REMOTE] QR generation failed:", e.message);
      return new Response("QR generation failed", { status: 500 });
    }
  }

  const validateMatch = path.match(/^\/api\/remote\/validate\/([a-z0-9]+)$/);
  if (validateMatch && method === "GET") {
    const token = validateMatch[1];
    return new Response(JSON.stringify({ valid: isValidToken(token) }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const invalidateMatch = path.match(/^\/api\/remote\/invalidate\/([a-z0-9]+)$/);
  if (invalidateMatch && method === "POST") {
    const token = invalidateMatch[1];
    invalidateToken(token);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
