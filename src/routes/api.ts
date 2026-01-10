/**
 * API routes (JSON responses)
 */
import { json, matchPath, URL_PATTERNS } from "../server";
import { getChapter, getFiction } from "../services/scraper";
import { getImageCache, setImageCache } from "../services/cache";
import { CACHE_TTL } from "../config";
import { createRemoteSession, isValidToken, invalidateToken, generateQRCode } from "../services/remote";
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
  getInvitationExpiryDays,
} from "../services/invitations";
import {
  getBook,
  getEpubFilePath,
  getCoverPath,
  updateProgress,
  getEpubFileContent,
} from "../services/epub";
import { isSourceEnabled } from "../services/sources";
import * as fs from "fs";

export async function handleApiRoute(
  req: Request,
  path: string,
  userId: string,
  isAdmin: boolean
): Promise<Response | null> {
  const method = req.method;

  // Chapter API (JSON) for SPA navigation - GET
  const chapterApiMatch = matchPath(path, URL_PATTERNS.chapterApi);
  if (chapterApiMatch && method === "GET") {
    const id = parseInt(chapterApiMatch[0], 10);

    try {
      const chapter = await getChapter(id, userId, CACHE_TTL.CHAPTER);
      if (!chapter) {
        return json({ error: "Chapter not found" }, 404);
      }

      // Extract chapter IDs from URLs
      const prevChapterId = chapter.prevChapterUrl
        ? parseInt(chapter.prevChapterUrl.replace("/chapter/", ""), 10)
        : null;
      const nextChapterId = chapter.nextChapterUrl
        ? parseInt(chapter.nextChapterUrl.replace("/chapter/", ""), 10)
        : null;

      return json({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        fictionId: chapter.fictionId,
        fictionTitle: chapter.fictionTitle,
        prevChapterId,
        nextChapterId,
      });
    } catch (error: any) {
      console.error(`Error fetching chapter API ${id}:`, error);
      return json({ error: error.message || "Failed to load chapter" }, 500);
    }
  }

  // Mark chapter as read - POST
  // This triggers authenticated request to Royal Road for reading progress
  if (chapterApiMatch && method === "POST") {
    const id = parseInt(chapterApiMatch[0], 10);

    try {
      await getChapter(id, userId);
      return json({ success: true, chapterId: id });
    } catch (error: any) {
      console.error(`Error marking chapter ${id} as read:`, error);
      return json({ error: error.message || "Failed to mark as read" }, 500);
    }
  }

  // Cover image proxy
  const coverMatch = matchPath(path, URL_PATTERNS.coverImage);
  if (coverMatch && method === "GET") {
    const fictionId = parseInt(coverMatch[0], 10);
    const cacheKey = `cover:${fictionId}`;

    // Check cache
    const cached = getImageCache(cacheKey);
    if (cached) {
      return new Response(new Uint8Array(cached.data), {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Fetch from Royal Road
    try {
      const fiction = await getFiction(fictionId);
      if (!fiction?.coverUrl) {
        return new Response("Cover not found", { status: 404 });
      }

      const imageResponse = await fetch(fiction.coverUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!imageResponse.ok) {
        return new Response("Failed to fetch cover", { status: 502 });
      }

      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
      const imageData = Buffer.from(await imageResponse.arrayBuffer());

      // Cache for 30 days
      setImageCache(cacheKey, imageData, contentType);

      return new Response(new Uint8Array(imageData), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error: any) {
      console.error(`Error fetching cover for fiction ${fictionId}:`, error);
      return new Response("Error fetching cover", { status: 500 });
    }
  }

  // WebSocket diagnostic report
  if (path === "/api/ws-test/report" && method === "POST") {
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
      
      return json({ received: true });
    } catch (e: any) {
      console.error("[WS-TEST] Failed to parse report:", e.message);
      return json({ error: "Invalid report format" }, 400);
    }
  }

  if (path === "/api/remote/create" && method === "POST") {
    const token = createRemoteSession();
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    
    return json({
      token,
      remoteUrl: `${protocol}://${host}/remote/${token}`,
      qrUrl: `/api/remote/qr/${token}`,
      wsUrl: `${protocol === "https" ? "wss" : "ws"}://${host}/ws/remote/${token}`,
    });
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
    return json({ valid: isValidToken(token) });
  }

  const invalidateMatch = path.match(/^\/api\/remote\/invalidate\/([a-z0-9]+)$/);
  if (invalidateMatch && method === "POST") {
    const token = invalidateMatch[1];
    invalidateToken(token);
    return json({ success: true });
  }

  if (path === "/api/invitations" && method === "GET") {
    if (!isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }
    const invitations = getPendingInvitations();
    return json({ invitations, expiryDays: getInvitationExpiryDays() });
  }

  if (path === "/api/invitations" && method === "POST") {
    if (!isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }
    
    try {
      const body = await req.json();
      const email = body.email?.trim();
      
      if (!email) {
        return json({ error: "Email is required" }, 400);
      }
      
      const invitation = createInvitation(email, userId);
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const host = req.headers.get("host") || "localhost:3000";
      const inviteUrl = `${protocol}://${host}/invite/${invitation.token}`;
      
      return json({
        invitation,
        inviteUrl,
        qrUrl: `/api/invitations/qr/${invitation.token}`,
      });
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      return json({ error: error.message || "Failed to create invitation" }, 500);
    }
  }

  const revokeMatch = path.match(/^\/api\/invitations\/([a-f0-9-]+)$/);
  if (revokeMatch && method === "DELETE") {
    if (!isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }
    
    const invitationId = revokeMatch[1];
    const revoked = revokeInvitation(invitationId);
    
    if (revoked) {
      return json({ success: true });
    } else {
      return json({ error: "Invitation not found or already used" }, 404);
    }
  }

  const inviteQrMatch = path.match(/^\/api\/invitations\/qr\/([a-z0-9]+)$/);
  if (inviteQrMatch && method === "GET") {
    const token = inviteQrMatch[1];
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const inviteUrl = `${protocol}://${host}/invite/${token}`;
    
    try {
      const qrBuffer = await generateQRCode(inviteUrl);
      return new Response(new Uint8Array(qrBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    } catch (e: any) {
      console.error("[INVITE] QR generation failed:", e.message);
      return new Response("QR generation failed", { status: 500 });
    }
  }

  const epubFileMatch = path.match(/^\/api\/epub\/([a-f0-9-]+)\/file$/);
  if (epubFileMatch && method === "GET") {
    const bookId = epubFileMatch[1];
    
    if (!isSourceEnabled(userId, "epub")) {
      return json({ error: "EPUB source not enabled" }, 403);
    }
    
    const book = getBook(bookId, userId);
    if (!book) {
      return json({ error: "Book not found" }, 404);
    }
    
    const filePath = getEpubFilePath(book.fileHash);
    if (!filePath) {
      return json({ error: "EPUB file not found" }, 404);
    }
    
    const fileData = fs.readFileSync(filePath);
    return new Response(new Uint8Array(fileData), {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `inline; filename="${encodeURIComponent(book.title)}.epub"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const epubProgressMatch = path.match(/^\/api\/epub\/([a-f0-9-]+)\/progress$/);
  if (epubProgressMatch && method === "POST") {
    const bookId = epubProgressMatch[1];
    
    if (!isSourceEnabled(userId, "epub")) {
      return json({ error: "EPUB source not enabled" }, 403);
    }
    
    try {
      const body = await req.json();
      const cfi = body.cfi;
      const progress = typeof body.progress === "number" ? body.progress : 0;
      
      if (!cfi) {
        return json({ error: "CFI is required" }, 400);
      }
      
      updateProgress(bookId, userId, cfi, progress);
      return json({ success: true });
    } catch (error: any) {
      console.error("Error saving EPUB progress:", error);
      return json({ error: "Failed to save progress" }, 500);
    }
  }

  const coverMatch2 = path.match(/^\/covers\/([a-f0-9-]+)$/);
  if (coverMatch2 && method === "GET") {
    const bookId = coverMatch2[1];
    
    const book = getBook(bookId, userId);
    if (!book || !book.coverPath) {
      return new Response("Cover not found", { status: 404 });
    }
    
    const coverFullPath = getCoverPath(book.coverPath);
    if (!coverFullPath) {
      return new Response("Cover file not found", { status: 404 });
    }
    
    const coverData = fs.readFileSync(coverFullPath);
    const contentType = book.coverPath.endsWith(".png") ? "image/png" : "image/jpeg";
    
    return new Response(new Uint8Array(coverData), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return null;
}
