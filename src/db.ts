import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const KELAR_DIR = join(homedir(), ".kelar");
const DB_PATH = join(KELAR_DIR, "kelar.db");

let _db: Database | null = null;

// Stored timestamps are always UTC so range queries can compare them as strings
function toUtcIso(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

function getDb(): Database {
  if (_db) return _db;

  if (!existsSync(KELAR_DIR)) {
    mkdirSync(KELAR_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  _db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      label TEXT,
      project TEXT,
      comment TEXT,
      minutes INTEGER NOT NULL,
      jira_worklog_id TEXT UNIQUE,
      is_jira INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Migration: Add columns if they don't exist
  const existingColumns = new Set(
    (_db.prepare("PRAGMA table_info(logs)").all() as { name: string }[]).map(col => col.name)
  );

  if (!existingColumns.has("label")) {
    _db.run("ALTER TABLE logs ADD COLUMN label TEXT");
  }
  if (!existingColumns.has("jira_worklog_id")) {
    _db.run("ALTER TABLE logs ADD COLUMN jira_worklog_id TEXT");
    _db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_worklog_id ON logs(jira_worklog_id)");
  }
  if (!existingColumns.has("project")) {
    _db.run("ALTER TABLE logs ADD COLUMN project TEXT");
  }
  if (!existingColumns.has("comment")) {
    _db.run("ALTER TABLE logs ADD COLUMN comment TEXT");
  }

  // Migration: created_at used to keep Jira's offset (e.g. "+0200"), which breaks string range
  // comparisons against UTC ISO bounds. Normalize legacy rows to UTC.
  const legacyRows = _db.prepare("SELECT id, created_at FROM logs WHERE created_at NOT LIKE '%Z'").all() as { id: number; created_at: string }[];
  if (legacyRows.length > 0) {
    const normalize = _db.prepare("UPDATE logs SET created_at = ? WHERE id = ?");
    _db.transaction(() => {
      for (const row of legacyRows) normalize.run(toUtcIso(row.created_at), row.id);
    })();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return _db;
}

export interface LogEntry {
  id?: number;
  identifier: string;
  label?: string;
  project?: string;
  comment?: string;
  minutes: number;
  jira_worklog_id?: string;
  is_jira: boolean;
  created_at: string;
}

export interface LogDbRow {
  id: number;
  identifier: string;
  label: string | null;
  project: string | null;
  comment: string | null;
  minutes: number;
  jira_worklog_id: string | null;
  is_jira: number; // SQLite stores boolean as 0/1
  created_at: string;
}

export const dbOps = {
  // Logs
  addLog: (log: LogEntry) => {
    const db = getDb();
    return db.prepare(`
      INSERT INTO logs (identifier, label, project, comment, minutes, jira_worklog_id, is_jira, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(jira_worklog_id) DO UPDATE SET
        identifier = excluded.identifier,
        label = excluded.label,
        project = excluded.project,
        comment = excluded.comment,
        minutes = excluded.minutes,
        created_at = excluded.created_at
    `).run(log.identifier, log.label || null, log.project || null, log.comment || null, log.minutes, log.jira_worklog_id || null, log.is_jira ? 1 : 0, toUtcIso(log.created_at));
  },

  getLogs: (sinceISO?: string, untilISO?: string): LogDbRow[] => {
    const db = getDb();
    if (sinceISO && untilISO) {
      return db.prepare("SELECT * FROM logs WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC").all(sinceISO, untilISO) as LogDbRow[];
    }
    if (sinceISO) {
      return db.prepare("SELECT * FROM logs WHERE created_at >= ? ORDER BY created_at DESC").all(sinceISO) as LogDbRow[];
    }
    return db.prepare("SELECT * FROM logs ORDER BY created_at DESC").all() as LogDbRow[];
  },

  deleteLogsByWorklogIds: (ids: string[]) => {
    if (ids.length === 0) return;
    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    return db.prepare(`DELETE FROM logs WHERE jira_worklog_id IN (${placeholders})`).run(...ids);
  },

  clearAllLogsInRange: (sinceISO: string, untilISO?: string) => {
    const db = getDb();
    if (untilISO) {
      return db.prepare("DELETE FROM logs WHERE created_at >= ? AND created_at < ?").run(sinceISO, untilISO);
    }
    return db.prepare("DELETE FROM logs WHERE created_at >= ?").run(sinceISO);
  },

  // Config
  getConfig: (key: string): string | null => {
    const db = getDb();
    const result = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | null;
    return result ? result.value : null;
  },

  setConfig: (key: string, value: string) => {
    const db = getDb();
    return db.prepare(`
      INSERT INTO config (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  },

  deleteConfigLike: (pattern: string) => {
    const db = getDb();
    return db.prepare("DELETE FROM config WHERE key LIKE ?").run(pattern);
  },

  deleteConfig: (key: string) => {
    const db = getDb();
    return db.prepare("DELETE FROM config WHERE key = ?").run(key);
  },

  getAllConfig: () => {
    const db = getDb();
    return db.prepare("SELECT * FROM config").all() as { key: string; value: string }[];
  }
};
