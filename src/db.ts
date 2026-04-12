import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const KELAR_DIR = join(homedir(), ".kelar");
const DB_PATH = join(KELAR_DIR, "kelar.db");

// Ensure directory exists
if (!existsSync(KELAR_DIR)) {
  mkdirSync(KELAR_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    label TEXT,
    minutes INTEGER NOT NULL,
    is_jira INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Migration: Add label column if it doesn't exist
try {
  db.run("ALTER TABLE logs ADD COLUMN label TEXT");
} catch {
  // Column already exists or other error we can ignore for now
}

db.run(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

export interface LogEntry {
  id?: number;
  identifier: string;
  label?: string;
  minutes: number;
  is_jira: boolean;
  created_at: string;
}

export interface LogDbRow {
  id: number;
  identifier: string;
  label: string | null;
  minutes: number;
  is_jira: number; // SQLite stores boolean as 0/1
  created_at: string;
}

export const dbOps = {
  // Logs
  addLog: (log: LogEntry) => {
    return db.prepare(`
      INSERT INTO logs (identifier, label, minutes, is_jira, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(log.identifier, log.label || null, log.minutes, log.is_jira ? 1 : 0, log.created_at);
  },

  getLogs: (sinceISO?: string): LogDbRow[] => {
    if (sinceISO) {
      return db.prepare("SELECT * FROM logs WHERE created_at >= ? ORDER BY created_at DESC").all(sinceISO) as any;
    }
    return db.prepare("SELECT * FROM logs ORDER BY created_at DESC").all() as any;
  },

  // Config
  getConfig: (key: string): string | null => {
    const result = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | null;
    return result ? result.value : null;
  },

  setConfig: (key: string, value: string) => {
    return db.prepare(`
      INSERT INTO config (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  },

  getAllConfig: () => {
    return db.prepare("SELECT * FROM config").all() as { key: string; value: string }[];
  }
};
