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
    jira_worklog_id TEXT UNIQUE,
    is_jira INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Migration: Add columns if they don't exist
const existingColumns = new Set(
  (db.prepare("PRAGMA table_info(logs)").all() as { name: string }[]).map(col => col.name)
);

if (!existingColumns.has("label")) {
  db.run("ALTER TABLE logs ADD COLUMN label TEXT");
}
if (!existingColumns.has("jira_worklog_id")) {
  db.run("ALTER TABLE logs ADD COLUMN jira_worklog_id TEXT");
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_worklog_id ON logs(jira_worklog_id)");
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
  jira_worklog_id?: string;
  is_jira: boolean;
  created_at: string;
}

export interface LogDbRow {
  id: number;
  identifier: string;
  label: string | null;
  minutes: number;
  jira_worklog_id: string | null;
  is_jira: number; // SQLite stores boolean as 0/1
  created_at: string;
}

export const dbOps = {
  // Logs
  addLog: (log: LogEntry) => {
    return db.prepare(`
      INSERT INTO logs (identifier, label, minutes, jira_worklog_id, is_jira, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(jira_worklog_id) DO UPDATE SET
        identifier = excluded.identifier,
        label = excluded.label,
        minutes = excluded.minutes,
        created_at = excluded.created_at
    `).run(log.identifier, log.label || null, log.minutes, log.jira_worklog_id || null, log.is_jira ? 1 : 0, log.created_at);
  },

  getLogs: (sinceISO?: string): LogDbRow[] => {
    if (sinceISO) {
      return db.prepare("SELECT * FROM logs WHERE created_at >= ? ORDER BY created_at DESC").all(sinceISO) as LogDbRow[];
    }
    return db.prepare("SELECT * FROM logs ORDER BY created_at DESC").all() as LogDbRow[];
  },

  deleteLogsByWorklogIds: (ids: string[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    return db.prepare(`DELETE FROM logs WHERE jira_worklog_id IN (${placeholders})`).run(...ids);
  },

  clearAllLogsInRange: (sinceISO: string) => {
    return db.prepare("DELETE FROM logs WHERE created_at >= ?").run(sinceISO);
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

  deleteConfigLike: (pattern: string) => {
    return db.prepare("DELETE FROM config WHERE key LIKE ?").run(pattern);
  },

  getAllConfig: () => {
    return db.prepare("SELECT * FROM config").all() as { key: string; value: string }[];
  }
};
