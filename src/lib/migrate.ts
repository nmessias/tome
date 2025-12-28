/**
 * Database migration script using Bun's native SQLite
 * Creates Better Auth tables if they don't exist
 * 
 * This replaces the @better-auth/cli migrate command which requires
 * better-sqlite3 (a native Node.js addon that can have compatibility issues)
 */
import { Database } from "bun:sqlite";
import { DB_PATH } from "../config";

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
  
  db.close();
  
  console.log("Database migrations completed successfully");
}

// Run migrations if this script is executed directly
if (import.meta.main) {
  runMigrations();
}
