import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import {
  BUILTIN_UX_PROFILE_ID,
  createBuiltinUxProfile
} from '@consoleri/core'

let db: DatabaseSync | null = null

// Exposed only for tests — production code never calls these.
export function setDatabaseForTest(dbOrPath: ':memory:' | string = ':memory:'): void {
  if (db) {
    db.close()
    db = null
  }
  db = new DatabaseSync(dbOrPath)
  initializeDatabase(db)
}

export function resetDatabaseForTest(): void {
  if (db) {
    db.close()
    db = null
  }
}

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
  log_verbosity TEXT NOT NULL DEFAULT 'info',
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

CREATE TABLE IF NOT EXISTS host_profile_links (
  host_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  PRIMARY KEY (host_id, profile_id),
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hpl_profile ON host_profile_links(profile_id);

CREATE TABLE IF NOT EXISTS vault_secrets (
  ref TEXT PRIMARY KEY,
  encrypted_blob TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_ssh_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  private_key_path TEXT NOT NULL UNIQUE,
  public_key_path TEXT,
  created_at TEXT NOT NULL
);
`

function initializeDatabase(database: DatabaseSync): void {
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(SCHEMA)
  migrateHostProfileLinks(database)
  migrateHostLogVerbosity(database)
  migrateUxProfiles(database)
  migrateHostRelations(database)
  migrateHostHttpEndpoint(database)
  migrateReports(database)

  const workspaceCount = database.prepare('SELECT COUNT(*) as c FROM workspaces').get() as {
    c: number
  }
  if (workspaceCount.c === 0) {
    database
      .prepare(`INSERT INTO workspaces (id, name, layout_json, is_last_active) VALUES (?, ?, ?, 1)`)
      .run(nanoid(), 'Default', 'null')
  }
}

export function getDatabase(): DatabaseSync {
  if (db) return db

  const userData = app.getPath('userData')
  if (!existsSync(userData)) {
    mkdirSync(userData, { recursive: true })
  }

  const dbPath = join(userData, 'consoleri.db')
  db = new DatabaseSync(dbPath)
  initializeDatabase(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function migrateHostProfileLinks(database: DatabaseSync): void {
  database.exec(`
    INSERT OR IGNORE INTO host_profile_links (host_id, profile_id)
    SELECT host_id, id FROM connection_profiles WHERE host_id IS NOT NULL
  `)
}

function migrateHostLogVerbosity(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(hosts)').all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === 'log_verbosity')) {
    database.exec(`ALTER TABLE hosts ADD COLUMN log_verbosity TEXT NOT NULL DEFAULT 'info'`)
  }
}

function migrateUxProfiles(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ux_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const hostColumns = database.prepare('PRAGMA table_info(hosts)').all() as Array<{ name: string }>
  if (!hostColumns.some((column) => column.name === 'ux_profile_id')) {
    database.exec(`ALTER TABLE hosts ADD COLUMN ux_profile_id TEXT`)
  }

  const count = database.prepare('SELECT COUNT(*) as c FROM ux_profiles').get() as { c: number }
  if (count.c === 0) {
    const builtin = createBuiltinUxProfile()
    database
      .prepare(
        `INSERT INTO ux_profiles (id, name, settings_json, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      .run(
        builtin.id,
        builtin.name,
        JSON.stringify({ terminal: builtin.terminal, chrome: builtin.chrome }),
        builtin.createdAt,
        builtin.updatedAt
      )
    database
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run('active_ux_profile_id', BUILTIN_UX_PROFILE_ID)
  }
}

function migrateHostRelations(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(hosts)').all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === 'related_hosts_json')) {
    database.exec(`ALTER TABLE hosts ADD COLUMN related_hosts_json TEXT NOT NULL DEFAULT '[]'`)
  }
  if (!columns.some((column) => column.name === 'gateway_host_id')) {
    database.exec(
      `ALTER TABLE hosts ADD COLUMN gateway_host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL`
    )
  }
}

function migrateHostHttpEndpoint(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(hosts)').all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === 'http_endpoint')) {
    database.exec(`ALTER TABLE hosts ADD COLUMN http_endpoint TEXT`)
  }
}

function migrateReports(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL,
      last_run_at TEXT,
      last_result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

