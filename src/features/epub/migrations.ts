/**
 * EPUB feature — DB migrations (moved from src/lib/migrate.ts).
 */
import type { Database } from "bun:sqlite";

export function migrateEpub(db: Database): void {
  // Create epub_files table for deduplicated EPUB storage
  db.run(`
    CREATE TABLE IF NOT EXISTS "epub_files" (
      "hash" TEXT PRIMARY KEY,
      "size" INTEGER NOT NULL,
      "uploadedAt" INTEGER NOT NULL,
      "refCount" INTEGER DEFAULT 1
    )
  `);

  // Create epub_books table for user's EPUB library
  db.run(`
    CREATE TABLE IF NOT EXISTS "epub_books" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "fileHash" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "author" TEXT,
      "coverPath" TEXT,
      "cfi" TEXT,
      "progress" INTEGER DEFAULT 0,
      "addedAt" INTEGER NOT NULL,
      "lastReadAt" INTEGER,
      FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
      FOREIGN KEY ("fileHash") REFERENCES "epub_files" ("hash")
    )
  `);

  // Create index for efficient library queries (sorted by last read)
  db.run(`
    CREATE INDEX IF NOT EXISTS "idx_epub_books_user"
    ON "epub_books" ("userId", "lastReadAt" DESC)
  `);
}
