/**
 * FreeWebNovel source adapter
 *
 * Wraps the FreeWebNovel scraper + local library services behind the Source
 * contract (ADR-0001). All scraping logic stays in src/services/fwn-scraper.ts
 * and src/services/fwn-library.ts.
 */
import type { Source } from "../services/source-registry";
import type { ChapterContent, Fiction, LibraryEntry } from "../types";
import {
  searchFictions,
  getFiction,
  getChapter,
} from "../services/fwn-scraper";
import {
  getLibrary,
  getLibraryEntry,
  isInLibrary,
  addToLibrary,
  removeFromLibrary,
  updateProgress,
  updateTotalChapters,
} from "../services/fwn-library";

const FWN = "freewebnovel";

function parseChapterNum(ref: string): number | null {
  const num = parseInt(ref, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeChapter(chapter: ChapterContent, slug: string): ChapterContent {
  const chapterNum = chapter.id;
  // Extract the trailing number from either legacy (/fwn/read/slug/4) or
  // chapter-slug (chapter-4) URL formats.
  const prevNum = chapter.prevChapterUrl?.match(/(?:chapter-)?(\d+)\/?$/)?.[1] || null;
  const nextNum = chapter.nextChapterUrl?.match(/(?:chapter-)?(\d+)\/?$/)?.[1] || null;
  return {
    ...chapter,
    ref: String(chapterNum),
    fictionRef: slug,
    prevRef: prevNum,
    nextRef: nextNum,
    prevChapterUrl: prevNum ? `/read/${FWN}/${slug}/${prevNum}` : undefined,
    nextChapterUrl: nextNum ? `/read/${FWN}/${slug}/${nextNum}` : undefined,
    fictionUrl: `/read/${FWN}/${slug}`,
  };
}

export const freewebnovelSource: Source = {
  name: FWN,
  displayName: "FreeWebNovel",
  description: "Read novels from freewebnovel.com (no account needed)",
  capabilities: {
    search: true,
    follows: false,
    history: false,
    toplists: false,
    readLater: false,
    bookmarks: false,
    library: true,
    credentials: false,
  },
  navLinks: [
    { href: `/read/${FWN}/search`, label: "Search" },
    { href: `/read/${FWN}/library`, label: "Library" },
  ],
  libraryActions: [{ href: `/read/${FWN}/search`, label: "Search Novels" }],

  // ---- core trio ----
  async search(query) {
    return searchFictions(query);
  },
  async getFiction(ref, userId): Promise<Fiction | null> {
    const fiction = await getFiction(ref);
    if (!fiction || !userId) return fiction;
    // Annotate with library state (progress, in-library flag, read chapters)
    if (isInLibrary(userId, ref)) {
      const entry = getLibraryEntry(userId, ref);
      const lastChapterRead = entry?.lastChapterRead || 0;
      if (fiction.chapters?.length) {
        updateTotalChapters(userId, ref, fiction.chapters.length);
      }
      fiction.isInLibrary = true;
      if (lastChapterRead > 0) {
        const next = lastChapterRead + 1;
        if (!fiction.chapters || next <= fiction.chapters.length) {
          fiction.continueChapterSlug = `chapter-${next}`;
          fiction.continueChapterLabel = `Ch. ${next}`;
        }
        fiction.chapters = fiction.chapters?.map((c) => ({
          ...c,
          isRead: (c.id as number) <= lastChapterRead,
        }));
      }
    }
    return fiction;
  },
  async getChapter(ref, chapterRef, userId) {
    const num = parseChapterNum(chapterRef);
    if (num === null) return null;
    const chapter = await getChapter(ref, num);
    if (!chapter) return null;
    const normalized = normalizeChapter(chapter, ref);
    if (userId && isInLibrary(userId, ref)) {
      // Keep local progress in sync on live reads
      updateProgress(userId, ref, num, `chapter-${num}`);
    }
    return normalized;
  },

  // ---- capability ops ----
  async getLibrary(userId): Promise<LibraryEntry[]> {
    return getLibrary(userId).map((e) => ({
      ref: e.slug,
      kind: "series",
      title: e.title,
      author: e.author ?? undefined,
      coverUrl: e.coverUrl ?? undefined,
      description: e.description ?? undefined,
      totalChapters: e.totalChapters,
      lastChapterRead: e.lastChapterRead,
      continueChapterRef:
        e.lastChapterRead > 0 && (e.totalChapters === 0 || e.lastChapterRead < e.totalChapters)
          ? String(e.lastChapterRead + 1)
          : undefined,
      completed: e.totalChapters > 0 && e.lastChapterRead >= e.totalChapters,
    }));
  },
  isInLibrary(userId, ref) {
    return isInLibrary(userId, ref);
  },
  async addToLibrary(userId, ref) {
    try {
      const fiction = await getFiction(ref);
      if (fiction) {
        addToLibrary(
          userId,
          ref,
          fiction.title,
          fiction.author,
          fiction.coverUrl,
          fiction.description,
          fiction.chapters?.length
        );
      } else {
        addToLibrary(userId, ref, ref);
      }
    } catch {
      addToLibrary(userId, ref, ref);
    }
  },
  removeFromLibrary(userId, ref) {
    removeFromLibrary(userId, ref);
  },
  updateProgress(userId, fictionRef, chapterRef) {
    const num = parseChapterNum(chapterRef);
    if (num === null) return;
    if (isInLibrary(userId, fictionRef)) {
      updateProgress(userId, fictionRef, num, `chapter-${num}`);
    }
  },
};
