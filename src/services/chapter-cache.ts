import type { Database } from "bun:sqlite";

export interface ChapterCacheBook {
  source: string;
  fictionRef: string;
  title: string;
  chapterCount: number;
  size: number;
  lastAccessedAt?: number;
}

interface Metadata {
  source: string;
  fictionRef: string;
  fictionTitle: string;
  chapterRef: string;
  cacheKey: string;
  lastAccessedAt?: number;
}

function parseMetadata(key: string, value: string): Metadata | null {
  try {
    const data = JSON.parse(value) as Metadata;
    if (!/^[a-z0-9-]+$/.test(data.source) ||
        !/^[1-9]\d*$/.test(data.fictionRef) ||
        !/^[1-9]\d*$/.test(data.chapterRef) ||
        data.cacheKey !== "chapter:" + data.chapterRef ||
        key !== "chapter-meta:" + data.source + ":" + data.fictionRef + ":" + data.chapterRef ||
        typeof data.fictionTitle !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

/** Aggregate only explicit metadata for public chapter content. */
export function listChapterCacheBooks(db: Database, now: number): ChapterCacheBook[] {
  const metadata = db.query("SELECT url, content FROM cache WHERE url LIKE 'chapter-meta:%' AND expires_at > ?")
    .all(now) as { url: string; content: string }[];
  const entries = db.query("SELECT url, length(CAST(content AS BLOB)) AS size FROM cache WHERE url LIKE 'chapter:%' OR url LIKE 'stale:chapter:%'")
    .all() as { url: string; size: number }[];
  const sizes = new Map(entries.map((row) => [row.url, row.size]));
  const books = new Map<string, ChapterCacheBook>();

  for (const row of metadata) {
    const item = parseMetadata(row.url, row.content);
    if (!item) continue;
    const size = (sizes.get(item.cacheKey) ?? 0) + (sizes.get("stale:" + item.cacheKey) ?? 0);
    if (!sizes.has(item.cacheKey) && !sizes.has("stale:" + item.cacheKey)) continue;
    const key = item.source + ":" + item.fictionRef;
    let book = books.get(key);
    if (!book) {
      book = { source: item.source, fictionRef: item.fictionRef, title: item.fictionTitle || "Novel " + item.fictionRef, chapterCount: 0, size: 0 };
      books.set(key, book);
    }
    book.chapterCount++;
    book.size += size;
    if (item.fictionTitle) book.title = item.fictionTitle;
    if (typeof item.lastAccessedAt === "number" && Number.isFinite(item.lastAccessedAt) &&
        item.lastAccessedAt > (book.lastAccessedAt ?? 0)) book.lastAccessedAt = item.lastAccessedAt;
  }
  return Array.from(books.values()).sort((a, b) => a.title.localeCompare(b.title));
}

/** Delete only entries identified by validated chapter metadata for this novel. */
export function deleteChapterCacheBook(db: Database, source: string, fictionRef: string): number {
  if (!/^[a-z0-9-]+$/.test(source) || !/^[1-9]\d*$/.test(fictionRef)) return 0;
  const rows = db.query("SELECT url, content FROM cache WHERE url LIKE 'chapter-meta:%'")
    .all() as { url: string; content: string }[];
  const remove = db.query("DELETE FROM cache WHERE url = ? OR url = ? OR url = ?");
  let chapters = 0;
  db.transaction(() => {
    for (const row of rows) {
      const item = parseMetadata(row.url, row.content);
      if (!item || item.source !== source || item.fictionRef !== fictionRef) continue;
      remove.run(row.url, item.cacheKey, "stale:" + item.cacheKey);
      chapters++;
    }
  })();
  return chapters;
}
