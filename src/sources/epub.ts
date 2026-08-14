/**
 * EPUB source adapter (core's reference adapter, ADR-0001)
 *
 * Wraps the local EPUB library service behind the Source contract. The EPUB
 * reader page is a source-specific page core doesn't model, so it is claimed
 * through the extraRoutes escape hatch.
 */
import * as fs from "fs";
import type { Source } from "../services/source-registry";
import type { LibraryEntry } from "../types";
import {
  getUserLibrary,
  getBook,
  deleteBook,
  uploadEpub,
  updateProgress,
  getEpubFilePath,
  getCoverPath,
} from "../features/epub/service";
import { EpubReaderPage } from "../features/epub/reader";
import { json, redirect } from "../server";

const EPUB = "epub";

export const epubSource: Source = {
  name: EPUB,
  displayName: "EPUB",
  description: "Upload and read your own EPUB files",
  capabilities: {
    search: false,
    follows: false,
    history: false,
    toplists: false,
    readLater: false,
    bookmarks: false,
    library: true,
    credentials: false,
  },
  navLinks: [{ href: `/read/${EPUB}/library`, label: "Library" }],
  libraryActions: [{ href: `/read/${EPUB}/upload`, label: "Upload EPUB" }],

  // ---- capability ops ----
  async getLibrary(userId): Promise<LibraryEntry[]> {
    return getUserLibrary(userId).map((b) => ({
      ref: b.id,
      kind: "book",
      title: b.title,
      author: b.author ?? undefined,
      coverUrl: b.coverPath ? `/covers/${b.id}` : undefined,
      progress: b.progress,
    }));
  },
  canUpload: true,
  async upload(userId, buffer, filename) {
    return uploadEpub(userId, buffer, filename);
  },
  updateProgress(userId, bookId, _chapterRef, body) {
    const { cfi, progress } = (body ?? {}) as { cfi?: string; progress?: number };
    if (!cfi) return { success: false, error: "CFI is required" };
    updateProgress(bookId, userId, cfi, typeof progress === "number" ? progress : 0);
    return { success: true };
  },

  // ---- source-specific pages/APIs (extraRoutes) ----
  extraRoutes: [
    {
      // EPUB reader (the "fiction page" for a book is the reader itself)
      match(path, method) {
        if (method !== "GET") return null;
        const m = path.match(/^\/read\/epub\/([a-f0-9-]+)$/);
        return m ? [m[1]] : null;
      },
      handle(params, ctx) {
        const book = getBook(params[0], ctx.userId);
        if (!book) return null; // fall through to generic 404
        return new Response(EpubReaderPage({ book, settings: ctx.settings }) as string, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
    {
      match(path, method) {
        if (method !== "POST") return null;
        const m = path.match(/^\/read\/epub\/([a-f0-9-]+)\/delete$/);
        return m ? [m[1]] : null;
      },
      handle(params, ctx) {
        deleteBook(params[0], ctx.userId);
        return redirect(`/read/${EPUB}/library`);
      },
    },
    {
      // EPUB file download for epubjs
      match(path, method) {
        if (method !== "GET") return null;
        const m = path.match(/^\/api\/read\/epub\/([a-f0-9-]+)\/file$/);
        return m ? [m[1]] : null;
      },
      handle(params, ctx) {
        const book = getBook(params[0], ctx.userId);
        if (!book) return json({ error: "Book not found" }, 404);
        const filePath = getEpubFilePath(book.fileHash);
        if (!filePath) return json({ error: "EPUB file not found" }, 404);
        const fileData = fs.readFileSync(filePath);
        return new Response(new Uint8Array(fileData), {
          headers: {
            "Content-Type": "application/epub+zip",
            "Content-Disposition": `inline; filename="${encodeURIComponent(book.title)}.epub"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
    {
      // Local cover files for EPUB books
      match(path, method) {
        if (method !== "GET") return null;
        const m = path.match(/^\/covers\/([a-f0-9-]+)$/);
        return m ? [m[1]] : null;
      },
      handle(params, ctx) {
        const book = getBook(params[0], ctx.userId);
        if (!book || !book.coverPath) return new Response("Cover not found", { status: 404 });
        const coverFullPath = getCoverPath(book.coverPath);
        if (!coverFullPath) return new Response("Cover file not found", { status: 404 });
        const coverData = fs.readFileSync(coverFullPath);
        const contentType = book.coverPath.endsWith(".png") ? "image/png" : "image/jpeg";
        return new Response(new Uint8Array(coverData), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  ],
};
