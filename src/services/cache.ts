/**
 * SQLite cache and session storage layer
 * Using Bun's built-in SQLite
 */
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, statSync, statfsSync } from "fs";
import { CACHE_TTL } from "../config";
import { deleteChapterCacheBook, listChapterCacheBooks, type ChapterCacheBook } from "./chapter-cache";

const DATA_DIR = "./data";
const DB_PATH = `${DATA_DIR}/sessions.db`;

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.run(`
  CREATE TABLE IF NOT EXISTS cookies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS cache (
    url TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS image_cache (
    url TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    content_type TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

// ============ Text Cache Operations ============

export function getCache(url: string): string | null {
  const now = Math.floor(Date.now() / 1000);
  const entry = db.query(
    "SELECT content FROM cache WHERE url = ? AND expires_at > ?"
  ).get(url, now) as { content: string } | null;
  return entry?.content ?? null;
}

// Check if a cache entry exists and is still valid (without returning the content)
export function isCached(url: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const entry = db.query(
    "SELECT 1 FROM cache WHERE url = ? AND expires_at > ?"
  ).get(url, now);
  return !!entry;
}

export function setCache(url: string, content: string, ttlSeconds: number = CACHE_TTL.DEFAULT): void {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.run(
    `INSERT INTO cache (url, content, expires_at) 
     VALUES (?, ?, ?) 
     ON CONFLICT(url) DO UPDATE SET content = ?, expires_at = ?`,
    [url, content, expiresAt, content, expiresAt]
  );
}

export function deleteCache(key: string): boolean {
  const result = db.run("DELETE FROM cache WHERE url = ?", [key]);
  return result.changes > 0;
}

export function clearCache(): void {
  db.run("DELETE FROM cache");
}

export function clearExpiredCache(): void {
  const now = Math.floor(Date.now() / 1000);
  db.run("DELETE FROM cache WHERE expires_at <= ?", [now]);
  db.run("DELETE FROM image_cache WHERE expires_at <= ?", [now]);
}

// Clear cache by type (e.g., "chapter", "fiction", "toplist")
export function clearCacheByType(type: string): number {
  if (type === "chapter") {
    const result = db.run("DELETE FROM cache WHERE url LIKE 'chapter:%' OR url LIKE 'stale:chapter:%' OR url LIKE 'chapter-meta:%'");
    return result.changes;
  }
  const result = db.run(`DELETE FROM cache WHERE url LIKE ?`, [`${type}:%`]);
  return result.changes;
}

export function clearChapterCacheBook(source: string, fictionRef: string): number {
  return deleteChapterCacheBook(db, source, fictionRef);
}

// ============ Image Cache Operations ============

export function getImageCache(url: string): { data: Buffer; contentType: string } | null {
  const now = Math.floor(Date.now() / 1000);
  const entry = db.query(
    "SELECT data, content_type FROM image_cache WHERE url = ? AND expires_at > ?"
  ).get(url, now) as { data: Buffer; content_type: string } | null;
  if (!entry) return null;
  return { data: entry.data, contentType: entry.content_type };
}

export function setImageCache(
  url: string,
  data: Buffer,
  contentType: string,
  ttlSeconds: number = CACHE_TTL.IMAGE
): void {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.run(
    `INSERT INTO image_cache (url, data, content_type, expires_at) 
     VALUES (?, ?, ?, ?) 
     ON CONFLICT(url) DO UPDATE SET data = ?, content_type = ?, expires_at = ?`,
    [url, data, contentType, expiresAt, data, contentType, expiresAt]
  );
}

export function clearImageCache(): number {
  const result = db.run("DELETE FROM image_cache");
  return result.changes;
}

// ============ Cache Statistics ============

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  byType: {
    type: string;
    count: number;
    size: number;
  }[];
  expiredCount: number;
  imageCount: number;
  imageSize: number;
  chapterBooks?: ChapterCacheBook[];
  databaseSize?: number;
  volumeAvailable?: number;
}

export function getCacheStats(includeChapterBooks = false): CacheStats {
  const now = Math.floor(Date.now() / 1000);
  
  // Get all cache entries with their types
  const entries = db.query(`
    SELECT url, length(CAST(content AS BLOB)) as size, expires_at
    FROM cache
  `).all() as { url: string; size: number; expires_at: number }[];
  
  // Count by type (extract type from cache key like "chapter:123", "fiction:456")
  const byTypeMap: Record<string, { count: number; size: number }> = {};
  let expiredCount = 0;
  
  for (const entry of entries) {
    if (entry.expires_at <= now) {
      expiredCount++;
    }
    // Metadata contributes to total bytes but is cleared with its chapters.
    if (entry.url.startsWith("chapter-meta:")) continue;
    const typeMatch = entry.url.match(/^([a-z]+):/);
    const type = typeMatch ? typeMatch[1] : "other";
    
    if (!byTypeMap[type]) {
      byTypeMap[type] = { count: 0, size: 0 };
    }
    byTypeMap[type].count++;
    byTypeMap[type].size += entry.size;
    
  }
  
  const byType = Object.entries(byTypeMap)
    .map(([type, data]) => ({
      type,
      count: data.count,
      size: data.size,
    }))
    .sort((a, b) => b.size - a.size);
  
  // Image cache stats
  const imageStats = db.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(length(data)), 0) as size
    FROM image_cache
  `).get() as { count: number; size: number };

  let databaseSize: number | undefined;
  let volumeAvailable: number | undefined;
  try {
    databaseSize = statSync(DB_PATH).size;
    if (existsSync(DB_PATH + "-wal")) databaseSize += statSync(DB_PATH + "-wal").size;
  } catch { /* File sizes may be unavailable on some hosts. */ }
  try {
    const volume = statfsSync(DATA_DIR);
    volumeAvailable = Number(volume.bavail) * Number(volume.bsize);
  } catch { /* Filesystem statistics are optional. */ }
  
  return {
    totalEntries: entries.length,
    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    byType,
    expiredCount,
    imageCount: imageStats.count,
    imageSize: imageStats.size,
    databaseSize,
    volumeAvailable,
    ...(includeChapterBooks ? { chapterBooks: listChapterCacheBooks(db, now) } : {}),
  };
}

export default db;
