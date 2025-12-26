// SQLite database layer using Bun's built-in SQLite
import { Database } from "bun:sqlite";
import type { Cookie, CacheEntry } from "./types";

const DB_PATH = "./data/sessions.db";

// Ensure data directory exists
import { mkdirSync, existsSync } from "fs";
if (!existsSync("./data")) {
  mkdirSync("./data", { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize tables
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

// Image cache table (stores binary data)
db.run(`
  CREATE TABLE IF NOT EXISTS image_cache (
    url TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    content_type TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

// Cookie operations
export function getCookies(): Cookie[] {
  return db.query("SELECT * FROM cookies").all() as Cookie[];
}

export function getCookie(name: string): Cookie | null {
  return db.query("SELECT * FROM cookies WHERE name = ?").get(name) as Cookie | null;
}

export function setCookie(name: string, value: string): void {
  db.run(
    `INSERT INTO cookies (name, value, updated_at) 
     VALUES (?, ?, unixepoch()) 
     ON CONFLICT(name) DO UPDATE SET value = ?, updated_at = unixepoch()`,
    [name, value, value]
  );
}

export function deleteCookie(name: string): void {
  db.run("DELETE FROM cookies WHERE name = ?", [name]);
}

export function clearCookies(): void {
  db.run("DELETE FROM cookies");
}

// Cache operations (5-minute default TTL)
const DEFAULT_TTL = 5 * 60; // 5 minutes in seconds

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

export function setCache(url: string, content: string, ttlSeconds: number = DEFAULT_TTL): void {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.run(
    `INSERT INTO cache (url, content, expires_at) 
     VALUES (?, ?, ?) 
     ON CONFLICT(url) DO UPDATE SET content = ?, expires_at = ?`,
    [url, content, expiresAt, content, expiresAt]
  );
}

export function clearCache(): void {
  db.run("DELETE FROM cache");
}

export function clearExpiredCache(): void {
  const now = Math.floor(Date.now() / 1000);
  db.run("DELETE FROM cache WHERE expires_at <= ?", [now]);
  db.run("DELETE FROM image_cache WHERE expires_at <= ?", [now]);
}

// Image cache operations
const IMAGE_TTL = 30 * 24 * 60 * 60; // 30 days for images

export function getImageCache(url: string): { data: Buffer; contentType: string } | null {
  const now = Math.floor(Date.now() / 1000);
  const entry = db.query(
    "SELECT data, content_type FROM image_cache WHERE url = ? AND expires_at > ?"
  ).get(url, now) as { data: Buffer; content_type: string } | null;
  if (!entry) return null;
  return { data: entry.data, contentType: entry.content_type };
}

export function setImageCache(url: string, data: Buffer, contentType: string, ttlSeconds: number = IMAGE_TTL): void {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.run(
    `INSERT INTO image_cache (url, data, content_type, expires_at) 
     VALUES (?, ?, ?, ?) 
     ON CONFLICT(url) DO UPDATE SET data = ?, content_type = ?, expires_at = ?`,
    [url, data, contentType, expiresAt, data, contentType, expiresAt]
  );
}

// Cache statistics
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
}

export function getCacheStats(): CacheStats {
  const now = Math.floor(Date.now() / 1000);
  
  // Get all cache entries with their types
  const entries = db.query(`
    SELECT url, length(content) as size, expires_at
    FROM cache
  `).all() as { url: string; size: number; expires_at: number }[];
  
  // Count by type (extract type from cache key like "chapter:123", "fiction:456")
  const byTypeMap: Record<string, { count: number; size: number }> = {};
  let expiredCount = 0;
  
  for (const entry of entries) {
    const typeMatch = entry.url.match(/^([a-z]+):/);
    const type = typeMatch ? typeMatch[1] : 'other';
    
    if (!byTypeMap[type]) {
      byTypeMap[type] = { count: 0, size: 0 };
    }
    byTypeMap[type].count++;
    byTypeMap[type].size += entry.size;
    
    if (entry.expires_at <= now) {
      expiredCount++;
    }
  }
  
  const byType = Object.entries(byTypeMap).map(([type, data]) => ({
    type,
    count: data.count,
    size: data.size,
  })).sort((a, b) => b.size - a.size);
  
  // Image cache stats
  const imageStats = db.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(length(data)), 0) as size
    FROM image_cache
  `).get() as { count: number; size: number };
  
  return {
    totalEntries: entries.length,
    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    byType,
    expiredCount,
    imageCount: imageStats.count,
    imageSize: imageStats.size,
  };
}

// Clear cache by type
export function clearCacheByType(type: string): number {
  const result = db.run(`DELETE FROM cache WHERE url LIKE ?`, [`${type}:%`]);
  return result.changes;
}

// Clear all image cache
export function clearImageCache(): number {
  const result = db.run("DELETE FROM image_cache");
  return result.changes;
}

// Get cookies formatted for Playwright
export function getCookiesForPlaywright(): { name: string; value: string; domain: string; path: string }[] {
  const cookies = getCookies();
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: ".royalroad.com",
    path: "/"
  }));
}

// Check if session cookies are configured
export function hasSessionCookies(): boolean {
  const identity = getCookie(".AspNetCore.Identity.Application");
  return !!identity;
}

export default db;
