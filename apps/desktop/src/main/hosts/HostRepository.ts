import { nanoid } from 'nanoid'
import type {
  ConnectionProfile,
  Host,
  HostFilter,
  HostGroup,
  HostInput,
  ProfileInput,
  Workspace,
  WorkspaceState
} from '../../shared/types'
import { getDatabase } from '../db/database'
import { credentialVault } from './CredentialVault'

function rowToHost(row: Record<string, unknown>): Host {
  return {
    id: row.id as string,
    name: row.name as string,
    hostname: row.hostname as string,
    port: row.port as number,
    osType: row.os_type as Host['osType'],
    tags: JSON.parse((row.tags_json as string) || '[]'),
    groupId: (row.group_id as string) || null,
    notes: (row.notes as string) || '',
    defaultProfileId: (row.default_profile_id as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function rowToProfile(row: Record<string, unknown>): ConnectionProfile {
  return {
    id: row.id as string,
    hostId: (row.host_id as string) || null,
    name: row.name as string,
    protocol: row.protocol as ConnectionProfile['protocol'],
    shell: (row.shell as string) || null,
    username: (row.username as string) || null,
    authMethod: row.auth_method as ConnectionProfile['authMethod'],
    credentialRef: (row.credential_ref as string) || null,
    jumpHostId: (row.jump_host_id as string) || null,
    extra: JSON.parse((row.extra_json as string) || '{}')
  }
}

export class HostRepository {
  listHosts(filter: HostFilter = {}): Host[] {
    const db = getDatabase()
    let sql = 'SELECT * FROM hosts WHERE 1=1'
    const params: (string | number)[] = []

    if (filter.search) {
      sql += ' AND (name LIKE ? OR hostname LIKE ? OR notes LIKE ?)'
      const q = `%${filter.search}%`
      params.push(q, q, q)
    }
    if (filter.groupId !== undefined) {
      if (filter.groupId === null) {
        sql += ' AND group_id IS NULL'
      } else {
        sql += ' AND group_id = ?'
        params.push(filter.groupId)
      }
    }

    sql += ' ORDER BY name COLLATE NOCASE'
    const stmt = db.prepare(sql)
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as Record<string, unknown>[]
    let hosts = rows.map((r) => rowToHost(r))

    if (filter.tags?.length) {
      hosts = hosts.filter((h) => filter.tags!.every((t) => h.tags.includes(t)))
    }
    return hosts
  }

  getHost(id: string): Host | null {
    const row = getDatabase().prepare('SELECT * FROM hosts WHERE id = ?').get(id)
    return row ? rowToHost(row as Record<string, unknown>) : null
  }

  createHost(input: HostInput): Host {
    const id = nanoid()
    const now = new Date().toISOString()
    const db = getDatabase()
    db.prepare(
      `INSERT INTO hosts (id, name, hostname, port, os_type, tags_json, group_id, notes, default_profile_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.hostname,
      input.port ?? 22,
      input.osType ?? 'unknown',
      JSON.stringify(input.tags ?? []),
      input.groupId ?? null,
      input.notes ?? '',
      input.defaultProfileId ?? null,
      now,
      now
    )
    return this.getHost(id)!
  }

  updateHost(id: string, input: Partial<HostInput>): Host {
    const existing = this.getHost(id)
    if (!existing) throw new Error(`Host not found: ${id}`)
    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `UPDATE hosts SET name=?, hostname=?, port=?, os_type=?, tags_json=?, group_id=?, notes=?, default_profile_id=?, updated_at=? WHERE id=?`
      )
      .run(
        input.name ?? existing.name,
        input.hostname ?? existing.hostname,
        input.port ?? existing.port,
        input.osType ?? existing.osType,
        JSON.stringify(input.tags ?? existing.tags),
        input.groupId !== undefined ? input.groupId : existing.groupId,
        input.notes ?? existing.notes,
        input.defaultProfileId !== undefined ? input.defaultProfileId : existing.defaultProfileId,
        now,
        id
      )
    return this.getHost(id)!
  }

  deleteHost(id: string): void {
    getDatabase().prepare('DELETE FROM hosts WHERE id = ?').run(id)
  }

  importHosts(items: HostInput[]): Host[] {
    return items.map((item) => this.createHost(item))
  }

  listGroups(): HostGroup[] {
    return getDatabase()
      .prepare('SELECT * FROM host_groups ORDER BY sort_order, name')
      .all()
      .map((row) => {
        const r = row as Record<string, unknown>
        return {
          id: r.id as string,
          name: r.name as string,
          parentId: (r.parent_id as string) || null,
          sortOrder: r.sort_order as number
        }
      })
  }

  createGroup(name: string, parentId: string | null = null): HostGroup {
    const id = nanoid()
    getDatabase()
      .prepare(`INSERT INTO host_groups (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)`)
      .run(id, name, parentId, 0)
    return { id, name, parentId, sortOrder: 0 }
  }

  listProfiles(hostId?: string): ConnectionProfile[] {
    const db = getDatabase()
    const rows = hostId
      ? db.prepare('SELECT * FROM connection_profiles WHERE host_id = ? ORDER BY name').all(hostId)
      : db.prepare('SELECT * FROM connection_profiles WHERE host_id IS NOT NULL ORDER BY name').all()
    return rows.map((r) => rowToProfile(r as Record<string, unknown>))
  }

  getProfile(id: string): ConnectionProfile | null {
    const row = getDatabase().prepare('SELECT * FROM connection_profiles WHERE id = ?').get(id)
    return row ? rowToProfile(row as Record<string, unknown>) : null
  }

  async createProfile(input: ProfileInput): Promise<ConnectionProfile> {
    const id = nanoid()
    let credentialRef = input.credentialRef ?? null

    if (input.password) {
      credentialRef = `profile:${id}:password`
      await credentialVault.store(credentialRef, input.password)
    } else if (input.privateKey) {
      credentialRef = `profile:${id}:key`
      await credentialVault.store(credentialRef, input.privateKey)
    }

    getDatabase()
      .prepare(
        `INSERT INTO connection_profiles (id, host_id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.hostId ?? null,
        input.name,
        input.protocol,
        input.shell ?? null,
        input.username ?? null,
        input.authMethod ?? 'password',
        credentialRef,
        input.jumpHostId ?? null,
        JSON.stringify(input.extra ?? {})
      )
    return this.getProfile(id)!
  }

  async updateProfile(id: string, input: Partial<ProfileInput>): Promise<ConnectionProfile> {
    const existing = this.getProfile(id)
    if (!existing) throw new Error(`Profile not found: ${id}`)

    let credentialRef = input.credentialRef !== undefined ? input.credentialRef : existing.credentialRef
    if (input.password) {
      credentialRef = `profile:${id}:password`
      await credentialVault.store(credentialRef, input.password)
    } else if (input.privateKey) {
      credentialRef = `profile:${id}:key`
      await credentialVault.store(credentialRef, input.privateKey)
    }

    getDatabase()
      .prepare(
        `UPDATE connection_profiles SET host_id=?, name=?, protocol=?, shell=?, username=?, auth_method=?, credential_ref=?, jump_host_id=?, extra_json=? WHERE id=?`
      )
      .run(
        input.hostId !== undefined ? input.hostId : existing.hostId,
        input.name ?? existing.name,
        input.protocol ?? existing.protocol,
        input.shell !== undefined ? input.shell : existing.shell,
        input.username !== undefined ? input.username : existing.username,
        input.authMethod ?? existing.authMethod,
        credentialRef,
        input.jumpHostId !== undefined ? input.jumpHostId : existing.jumpHostId,
        JSON.stringify(input.extra ?? existing.extra),
        id
      )
    return this.getProfile(id)!
  }

  deleteProfile(id: string): void {
    getDatabase().prepare('DELETE FROM connection_profiles WHERE id = ?').run(id)
  }

  getActiveWorkspace(): Workspace {
    const row = getDatabase()
      .prepare('SELECT * FROM workspaces WHERE is_last_active = 1 LIMIT 1')
      .get() as Record<string, unknown> | undefined
    if (!row) {
      const id = nanoid()
      getDatabase()
        .prepare(`INSERT INTO workspaces (id, name, layout_json, is_last_active) VALUES (?, ?, ?, 1)`)
        .run(id, 'Default', 'null')
      return { id, name: 'Default', layoutJson: 'null', isLastActive: true }
    }
    return {
      id: row.id as string,
      name: row.name as string,
      layoutJson: row.layout_json as string,
      isLastActive: Boolean(row.is_last_active)
    }
  }

  saveWorkspace(state: WorkspaceState, name = 'Default'): Workspace {
    const db = getDatabase()
    const existing = this.getActiveWorkspace()
    const layoutJson = JSON.stringify({ layout: state.layout, panes: state.panes })

    db.prepare(`UPDATE workspaces SET is_last_active = 0`).run()
    db.prepare(
      `UPDATE workspaces SET name=?, layout_json=?, is_last_active=1 WHERE id=?`
    ).run(name, layoutJson, existing.id)

    db.prepare(`DELETE FROM workspace_panes WHERE workspace_id = ?`).run(existing.id)
    const insertPane = db.prepare(
      `INSERT INTO workspace_panes (id, workspace_id, pane_id, session_snapshot_json) VALUES (?, ?, ?, ?)`
    )
    for (const pane of state.panes) {
      insertPane.run(nanoid(), existing.id, pane.paneId, JSON.stringify(pane))
    }

    return this.getActiveWorkspace()
  }

  loadWorkspace(): WorkspaceState {
    const ws = this.getActiveWorkspace()
    try {
      const parsed = JSON.parse(ws.layoutJson) as WorkspaceState
      if (parsed && 'layout' in parsed) return parsed
    } catch {
      /* fall through */
    }
    return { layout: null, panes: [] }
  }

  saveSessionSnapshot(snapshot: {
    id: string
    hostId: string | null
    profileId: string | null
    protocol: string
    title: string
    cwd: string | null
    cols: number
    rows: number
    scrollbackSerialized: string | null
  }): void {
    getDatabase()
      .prepare(
        `INSERT OR REPLACE INTO session_snapshots (id, host_id, profile_id, protocol, title, cwd, cols, rows, scrollback_serialized, disconnected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        snapshot.id,
        snapshot.hostId,
        snapshot.profileId,
        snapshot.protocol,
        snapshot.title,
        snapshot.cwd,
        snapshot.cols,
        snapshot.rows,
        snapshot.scrollbackSerialized,
        new Date().toISOString()
      )
  }

  getSessionSnapshot(id: string) {
    const row = getDatabase().prepare('SELECT * FROM session_snapshots WHERE id = ?').get(id)
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      hostId: (r.host_id as string) || null,
      profileId: (r.profile_id as string) || null,
      protocol: r.protocol as string,
      title: r.title as string,
      cwd: (r.cwd as string) || null,
      cols: r.cols as number,
      rows: r.rows as number,
      scrollbackSerialized: (r.scrollback_serialized as string) || null,
      disconnectedAt: (r.disconnected_at as string) || null
    }
  }
}

export const hostRepository = new HostRepository()
