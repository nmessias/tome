import { Database } from "bun:sqlite";
import { DB_PATH } from "../config";

export type SourceType = "royalroad" | "epub";

export const ALL_SOURCES: SourceType[] = ["royalroad", "epub"];

export interface UserSource {
  source: SourceType;
  enabled: boolean;
}

function getDb(): Database {
  return new Database(DB_PATH);
}

export function getUserSources(userId: string): UserSource[] {
  const db = getDb();
  try {
    const rows = db.query(`
      SELECT source, enabled FROM user_sources WHERE userId = ?
    `).all(userId) as { source: string; enabled: number }[];
    
    const enabledMap = new Map(rows.map(r => [r.source, r.enabled === 1]));
    
    return ALL_SOURCES.map(source => ({
      source,
      enabled: enabledMap.get(source) ?? false,
    }));
  } finally {
    db.close();
  }
}

export function setSourceEnabled(userId: string, source: SourceType, enabled: boolean): void {
  const db = getDb();
  try {
    db.run(`
      INSERT INTO user_sources (userId, source, enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, source) DO UPDATE SET enabled = excluded.enabled
    `, [userId, source, enabled ? 1 : 0]);
  } finally {
    db.close();
  }
}

export function isSourceEnabled(userId: string, source: SourceType): boolean {
  const db = getDb();
  try {
    const row = db.query(`
      SELECT enabled FROM user_sources WHERE userId = ? AND source = ?
    `).get(userId, source) as { enabled: number } | null;
    
    return row?.enabled === 1;
  } finally {
    db.close();
  }
}

export function getEnabledSources(userId: string): SourceType[] {
  const db = getDb();
  try {
    const rows = db.query(`
      SELECT source FROM user_sources WHERE userId = ? AND enabled = 1
    `).all(userId) as { source: string }[];
    
    return rows.map(r => r.source as SourceType);
  } finally {
    db.close();
  }
}
