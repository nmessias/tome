/**
 * Database migration script using Bun's native SQLite
 * Creates Better Auth tables if they don't exist
 * 
 * This replaces the @better-auth/cli migrate command which requires
 * better-sqlite3 (a native Node.js addon that can have compatibility issues)
 */
import { Database } from "bun:sqlite";
import { DB_PATH } from "../config";
import { getFeatures } from "../services/feature-registry";

/**
 * Check if a column exists in a table
 */
function columnExists(db: Database, table: string, column: string): boolean {
  const result = db.query(`PRAGMA table_info("${table}")`).all() as { name: string }[];
  return result.some(col => col.name === column);
}

/**
 * Run database migrations
 * Creates all required Better Auth tables if they don't exist
 */
export function runMigrations(): void {
  console.log("Running database migrations...");
  
  // Ensure data directory exists
  const dataDir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
  if (dataDir) {
    const fs = require("fs");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON");
  
  // Create user table
  db.run(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" INTEGER NOT NULL,
      "image" TEXT,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL,
      "username" TEXT UNIQUE,
      "displayUsername" TEXT
    )
  `);
  
  // Add role column to user table if it doesn't exist
  if (!columnExists(db, "user", "role")) {
    console.log("Adding 'role' column to user table...");
    db.run(`ALTER TABLE "user" ADD COLUMN "role" TEXT DEFAULT 'user'`);
  }
  
  // Create session table
  db.run(`
    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "expiresAt" DATE NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
    )
  `);
  
  // Create account table (for credentials/OAuth)
  db.run(`
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" DATE,
      "refreshTokenExpiresAt" DATE,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL
    )
  `);
  
  // Create verification table (for email verification, password reset, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" DATE NOT NULL,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL
    )
  `);
  
  // Create invitation table for multi-user support
  db.run(`
    CREATE TABLE IF NOT EXISTS "invitation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdBy" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL,
      "expiresAt" INTEGER NOT NULL,
      "usedAt" INTEGER,
      "usedBy" TEXT,
      FOREIGN KEY ("createdBy") REFERENCES "user" ("id"),
      FOREIGN KEY ("usedBy") REFERENCES "user" ("id")
    )
  `);
  
  // Create user_source_credentials table for per-user source credentials
  // One row per (user, source, credential name). Sources are identified by their registered machine name.
  db.run(`
    CREATE TABLE IF NOT EXISTS "user_source_credentials" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" INTEGER DEFAULT (unixepoch()),
      UNIQUE("userId", "source", "name"),
      FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
    )
  `);
  
  // Create index for efficient credential lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS "idx_user_source_credentials_lookup" 
    ON "user_source_credentials" ("userId", "source")
  `);
  
  // Create user_sources table for tracking enabled sources per user
  db.run(`
    CREATE TABLE IF NOT EXISTS "user_sources" (
      "userId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "enabled" INTEGER DEFAULT 0,
      PRIMARY KEY ("userId", "source"),
      FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
    )
  `);
  
  // Feature-owned tables (e.g. epub_files, fwn_library, plugin migrations)
  for (const feature of getFeatures()) {
    feature.migrations?.(db);
  }

  db.close();

  console.log("Database migrations completed successfully");
}

if (import.meta.main) {
  runMigrations();
}
