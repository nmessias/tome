/**
 * FreeWebNovel local library service
 * Tracks which FWN fictions the user is reading and their reading progress.
 * All data is stored locally since there's no FWN account.
 */
import { Database } from "bun:sqlite";
import { DB_PATH } from "../config";

export interface FwnLibraryEntry {
  id: number;
  userId: string;
  slug: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
  totalChapters: number;
  lastChapterRead: number;
  lastChapterSlug: string | null;
  addedAt: number;
  lastReadAt: number | null;
}

function getDb(): Database {
  return new Database(DB_PATH);
}

/**
 * Add a fiction to the user's FWN library
 */
export function addToLibrary(
  userId: string,
  slug: string,
  title: string,
  author?: string,
  coverUrl?: string,
  description?: string,
  totalChapters?: number
): void {
  const db = getDb();
  try {
    db.run(
      `INSERT INTO fwn_library (userId, slug, title, author, coverUrl, description, totalChapters, addedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(userId, slug) DO UPDATE SET
         title = excluded.title,
         author = COALESCE(excluded.author, fwn_library.author),
         coverUrl = COALESCE(excluded.coverUrl, fwn_library.coverUrl),
         description = COALESCE(excluded.description, fwn_library.description),
         totalChapters = COALESCE(excluded.totalChapters, fwn_library.totalChapters)`,
      [userId, slug, title, author || null, coverUrl || null, description || null, totalChapters || 0]
    );
  } finally {
    db.close();
  }
}

/**
 * Remove a fiction from the user's FWN library
 */
export function removeFromLibrary(userId: string, slug: string): void {
  const db = getDb();
  try {
    db.run(
      `DELETE FROM fwn_library WHERE userId = ? AND slug = ?`,
      [userId, slug]
    );
  } finally {
    db.close();
  }
}

/**
 * Get all fictions in the user's FWN library (sorted by last read, then added)
 */
export function getLibrary(userId: string): FwnLibraryEntry[] {
  const db = getDb();
  try {
    return db.query(
      `SELECT * FROM fwn_library WHERE userId = ?
       ORDER BY COALESCE(lastReadAt, addedAt) DESC`
    ).all(userId) as FwnLibraryEntry[];
  } finally {
    db.close();
  }
}

/**
 * Get a specific library entry
 */
export function getLibraryEntry(userId: string, slug: string): FwnLibraryEntry | null {
  const db = getDb();
  try {
    return (db.query(
      `SELECT * FROM fwn_library WHERE userId = ? AND slug = ?`
    ).get(userId, slug) as FwnLibraryEntry | null);
  } finally {
    db.close();
  }
}

/**
 * Check if a fiction is in the user's library
 */
export function isInLibrary(userId: string, slug: string): boolean {
  const db = getDb();
  try {
    const row = db.query(
      `SELECT 1 FROM fwn_library WHERE userId = ? AND slug = ?`
    ).get(userId, slug);
    return !!row;
  } finally {
    db.close();
  }
}

/**
 * Update reading progress for a fiction
 */
export function updateProgress(
  userId: string,
  slug: string,
  chapterNum: number,
  chapterSlug?: string
): void {
  const db = getDb();
  try {
    // Only update if this chapter is further than what's already recorded
    db.run(
      `UPDATE fwn_library
       SET lastChapterRead = MAX(lastChapterRead, ?),
           lastChapterSlug = CASE WHEN ? > lastChapterRead THEN ? ELSE lastChapterSlug END,
           lastReadAt = unixepoch()
       WHERE userId = ? AND slug = ?`,
      [chapterNum, chapterNum, chapterSlug || `chapter-${chapterNum}`, userId, slug]
    );
  } finally {
    db.close();
  }
}

/**
 * Update total chapters count for a fiction in library
 */
export function updateTotalChapters(
  userId: string,
  slug: string,
  totalChapters: number
): void {
  const db = getDb();
  try {
    db.run(
      `UPDATE fwn_library SET totalChapters = ? WHERE userId = ? AND slug = ?`,
      [totalChapters, userId, slug]
    );
  } finally {
    db.close();
  }
}
