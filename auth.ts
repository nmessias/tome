/**
 * Better Auth CLI configuration
 * This file uses better-sqlite3 which works with the Node.js-based CLI
 * The main auth.ts uses bun:sqlite which works at runtime
 */
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import Database from "better-sqlite3";

const DB_PATH = "./data/sessions.db";
const db = new Database(DB_PATH);

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [username()],
  session: {
    expiresIn: 60 * 60 * 24 * 365, // 1 year
    updateAge: 60 * 60 * 24,
  },
});
