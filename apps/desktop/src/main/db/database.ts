import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

let db: DatabaseSync | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS host_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 22,
  os_type TEXT NOT NULL DEFAULT 'unknown',
  tags_json TEXT NOT NULL DEFAULT '[]',
  group_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  default_profile_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES host_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS connection_profiles (
  id TEXT PRIMARY KEY,
  host_id TEXT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  shell TEXT,
  username TEXT,
  auth_method TEXT NOT NULL DEFAULT 'password',
  credential_ref TEXT,
  jump_host_id TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  FOREIGN KEY (jump_host_id) REFERENCES hosts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layout_json TEXT NOT NULL DEFAULT 'null',
  is_last_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workspace_panes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pane_id TEXT NOT NULL,
  session_snapshot_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_snapshots (
  id TEXT PRIMARY KEY,
  host_id TEXT,
  profile_id TEXT,
  protocol TEXT NOT NULL,
  title TEXT NOT NULL,
  cwd TEXT,
  cols INTEGER NOT NULL DEFAULT 80,
  rows INTEGER NOT NULL DEFAULT 24,
  scrollback_serialized TEXT,
  disconnected_at TEXT,
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL,
  FOREIGN KEY (profile_id) REFERENCES connection_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hosts_group ON hosts(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_host ON connection_profiles(host_id);

CREATE TABLE IF NOT EXISTS vault_secrets (
  ref TEXT PRIMARY KEY,
  encrypted_blob TEXT NOT NULL
);
`

export function getDatabase(): DatabaseSync {
  if (db) return db

  const userData = app.getPath('userData')
  if (!existsSync(userData)) {
    mkdirSync(userData, { recursive: true })
  }

  const dbPath = join(userData, 'consoleri.db')
  db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)

  const workspaceCount = db.prepare('SELECT COUNT(*) as c FROM workspaces').get() as { c: number }
  if (workspaceCount.c === 0) {
    db.prepare(
      `INSERT INTO workspaces (id, name, layout_json, is_last_active) VALUES (?, ?, ?, 1)`
    ).run(nanoid(), 'Default', 'null')
  }

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
