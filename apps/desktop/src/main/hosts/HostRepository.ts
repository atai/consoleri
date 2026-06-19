import { nanoid } from 'nanoid'
import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import {
  authTypeFromCredentialRef,
  buildHostsExportDocument,
  hostCreateFromExportItem,
  hostRelationPatchFromExportItem,
  groupCreateFromExportItem,
  isKeyFileRef,
  isVaultRef,
  makeProfileCredentialRef,
  normalizeHostLogVerbosity,
  normalizeGatewayHostId,
  normalizeHttpEndpoint,
  normalizeRelatedHostIds,
  parseHostsImportPayload,
  profileCreateFromExportItem,
  resolveHostProfileLink,
  rowToHost,
  rowToProfile,
  serializeHostsExportDocument,
  sortGroupsForImport,
  type HostProfileLinkExport,
  type HostsExportDocument
} from '@consoleri/core'
import type {
  ConnectionProfile,
  Host,
  HostFilter,
  HostGroup,
  HostInput,
  OpenSessionRequest,
  PaneBinding,
  ProfileInput,
  Workspace,
  WorkspaceState
} from '../../shared/types'
import { getDatabase } from '../db/database'
import { secretBackendService } from '../secrets/SecretBackendService'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'
import { uxProfileRepository } from '../ux/UxProfileRepository'

export class HostRepository {
  private existingHostIdSet(): Set<string> {
    const rows = getDatabase().prepare('SELECT id FROM hosts').all() as Array<{ id: string }>
    return new Set(rows.map((r) => r.id))
  }

  private existingHostsForGateway(): Array<{ id: string; gatewayHostId: string | null }> {
    return this.listHosts().map((h) => ({ id: h.id, gatewayHostId: h.gatewayHostId }))
  }

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
    const existingIds = this.existingHostIdSet()
    const relatedHostIds = normalizeRelatedHostIds(id, input.relatedHostIds, existingIds)
    const gatewayHostId = normalizeGatewayHostId(id, input.gatewayHostId ?? null, this.existingHostsForGateway())
    const httpEndpoint = normalizeHttpEndpoint(input.httpEndpoint)
    db.prepare(
      `INSERT INTO hosts (id, name, hostname, port, os_type, tags_json, group_id, notes, default_profile_id, ux_profile_id, log_verbosity, related_hosts_json, gateway_host_id, http_endpoint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      input.uxProfileId ?? null,
      normalizeHostLogVerbosity(input.logVerbosity),
      JSON.stringify(relatedHostIds),
      gatewayHostId,
      httpEndpoint,
      now,
      now
    )
    return this.getHost(id)!
  }

  updateHost(id: string, input: Partial<HostInput>): Host {
    const existing = this.getHost(id)
    if (!existing) throw new Error(`Host not found: ${id}`)
    const now = new Date().toISOString()
    const existingIds = this.existingHostIdSet()
    const relatedHostIds =
      input.relatedHostIds !== undefined
        ? normalizeRelatedHostIds(id, input.relatedHostIds, existingIds)
        : existing.relatedHostIds
    const gatewayHostId =
      input.gatewayHostId !== undefined
        ? normalizeGatewayHostId(id, input.gatewayHostId, this.existingHostsForGateway())
        : existing.gatewayHostId
    const httpEndpoint =
      input.httpEndpoint !== undefined
        ? normalizeHttpEndpoint(input.httpEndpoint)
        : existing.httpEndpoint
    getDatabase()
      .prepare(
        `UPDATE hosts SET name=?, hostname=?, port=?, os_type=?, tags_json=?, group_id=?, notes=?, default_profile_id=?, ux_profile_id=?, log_verbosity=?, related_hosts_json=?, gateway_host_id=?, http_endpoint=?, updated_at=? WHERE id=?`
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
        input.uxProfileId !== undefined ? input.uxProfileId : existing.uxProfileId,
        input.logVerbosity !== undefined
          ? normalizeHostLogVerbosity(input.logVerbosity)
          : existing.logVerbosity,
        JSON.stringify(relatedHostIds),
        gatewayHostId,
        httpEndpoint,
        now,
        id
      )
    return this.getHost(id)!
  }

  deleteHost(id: string): void {
    getDatabase().prepare('DELETE FROM hosts WHERE id = ?').run(id)
  }

  importHosts(payload: unknown): Promise<Host[]> {
    const doc = parseHostsImportPayload(payload)
    return this.importHostsBundle(doc)
  }

  exportHostsBundle(): HostsExportDocument {
    const groups = this.listGroups()
    const hosts = this.listHosts()
    const profiles = this.listProfiles()
    const links = this.listAllProfileLinks()
    return buildHostsExportDocument(groups, hosts, profiles, links)
  }

  async exportHostsToFile(): Promise<{ path: string } | { canceled: true }> {
    const doc = this.exportHostsBundle()
    const date = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: 'Export hosts JSON',
      defaultPath: `consoleri-hosts-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, serializeHostsExportDocument(doc), 'utf8')
    return { path: result.filePath }
  }

  listAllProfileLinks(): HostProfileLinkExport[] {
    this.syncLegacyProfileLinks()
    const rows = getDatabase()
      .prepare('SELECT host_id, profile_id FROM host_profile_links')
      .all() as Array<{ host_id: string; profile_id: string }>
    return rows.map((row) => ({
      hostId: row.host_id,
      profileId: row.profile_id
    }))
  }

  async importHostsBundle(doc: HostsExportDocument): Promise<Host[]> {
    const groupIdMap = new Map<string, string>()
    const hostIdMap = new Map<string, string>()
    const profileIdMap = new Map<string, string>()
    const createdHosts: Host[] = []
    const validUxProfileIds = new Set(uxProfileRepository.list().map((profile) => profile.id))

    for (const group of sortGroupsForImport(doc.groups)) {
      const planned = groupCreateFromExportItem(group, groupIdMap)
      const created = this.createGroup(planned.name, planned.parentId, planned.sortOrder)
      groupIdMap.set(planned.exportId, created.id)
    }

    for (const host of doc.hosts) {
      const planned = hostCreateFromExportItem(host, groupIdMap, validUxProfileIds)
      const created = this.createHost(planned.input)
      hostIdMap.set(planned.exportId, created.id)
      createdHosts.push(created)
    }

    for (const profile of doc.profiles) {
      const planned = profileCreateFromExportItem(profile, hostIdMap)
      const created = await this.createProfile(planned.input)
      profileIdMap.set(planned.exportId, created.id)
    }

    for (const link of doc.links) {
      const resolved = resolveHostProfileLink(link, hostIdMap, profileIdMap)
      if (resolved) {
        this.linkHostProfile(resolved.hostId, resolved.profileId)
      }
    }

    for (const host of doc.hosts) {
      const hostId = hostIdMap.get(host.exportId)
      if (!hostId) continue

      const patch = hostRelationPatchFromExportItem(host, hostIdMap, profileIdMap)
      if (patch) {
        this.updateHost(hostId, patch.patch)
      }
    }

    return createdHosts.map((host) => this.getHost(host.id) ?? host)
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

  createGroup(name: string, parentId: string | null = null, sortOrder = 0): HostGroup {
    const id = nanoid()
    getDatabase()
      .prepare(`INSERT INTO host_groups (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)`)
      .run(id, name, parentId, sortOrder)
    return { id, name, parentId, sortOrder }
  }

  private syncLegacyProfileLinks(): void {
    getDatabase().exec(`
      INSERT OR IGNORE INTO host_profile_links (host_id, profile_id)
      SELECT host_id, id FROM connection_profiles WHERE host_id IS NOT NULL
    `)
  }

  listProfiles(hostId?: string): ConnectionProfile[] {
    this.syncLegacyProfileLinks()
    const db = getDatabase()
    const rows = hostId
      ? db
          .prepare(
            `SELECT p.* FROM connection_profiles p
             INNER JOIN host_profile_links l ON l.profile_id = p.id
             WHERE l.host_id = ?
             ORDER BY p.name`
          )
          .all(hostId)
      : db.prepare('SELECT * FROM connection_profiles ORDER BY name').all()
    return rows.map((r) => rowToProfile(r as Record<string, unknown>))
  }

  listHostsForProfile(profileId: string): Host[] {
    this.syncLegacyProfileLinks()
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT h.* FROM hosts h
         INNER JOIN host_profile_links l ON l.host_id = h.id
         WHERE l.profile_id = ?
         ORDER BY h.name COLLATE NOCASE`
      )
      .all(profileId)
    return rows.map((r) => rowToHost(r as Record<string, unknown>))
  }

  linkHostProfile(hostId: string, profileId: string): void {
    const host = this.getHost(hostId)
    if (!host) throw new Error(`Host not found: ${hostId}`)
    const profile = this.getProfile(profileId)
    if (!profile) throw new Error(`Profile not found: ${profileId}`)
    getDatabase()
      .prepare('INSERT OR IGNORE INTO host_profile_links (host_id, profile_id) VALUES (?, ?)')
      .run(hostId, profileId)
  }

  unlinkHostProfile(hostId: string, profileId: string): void {
    getDatabase()
      .prepare('DELETE FROM host_profile_links WHERE host_id = ? AND profile_id = ?')
      .run(hostId, profileId)
  }

  isProfileLinkedToHost(hostId: string, profileId: string): boolean {
    const row = getDatabase()
      .prepare(
        'SELECT 1 FROM host_profile_links WHERE host_id = ? AND profile_id = ? LIMIT 1'
      )
      .get(hostId, profileId)
    return Boolean(row)
  }

  getProfile(id: string): ConnectionProfile | null {
    const row = getDatabase().prepare('SELECT * FROM connection_profiles WHERE id = ?').get(id)
    return row ? rowToProfile(row as Record<string, unknown>) : null
  }

  private vaultOptions() {
    const settings = vaultSettingsRepository.getSettings()
    return { mount: settings.defaultKvMount, prefix: settings.secretPathPrefix }
  }

  private resolveSecretBackend(input?: Partial<ProfileInput>): 'local' | 'vault' {
    return input?.secretBackend ?? vaultSettingsRepository.getDefaultBackend()
  }

  private async deleteCredentialRef(credentialRef: string | null): Promise<void> {
    if (!credentialRef || isKeyFileRef(credentialRef)) return
    try {
      await secretBackendService.delete(credentialRef)
    } catch {
      /* best effort cleanup */
    }
  }

  private async copyCredentialRefForProfile(
    sourceCredentialRef: string | null,
    newProfileId: string
  ): Promise<string | null> {
    if (!sourceCredentialRef) return null
    if (isKeyFileRef(sourceCredentialRef)) return sourceCredentialRef

    const secret = await secretBackendService.retrieve(sourceCredentialRef)
    if (!secret) return null

    if (isVaultRef(sourceCredentialRef)) {
      const material =
        authTypeFromCredentialRef(sourceCredentialRef) === 'privateKey' ? 'privateKey' : 'password'
      const credentialRef = makeProfileCredentialRef(
        'vault',
        newProfileId,
        material,
        this.vaultOptions()
      )
      await secretBackendService.store(credentialRef, secret)
      return credentialRef
    }

    if (!sourceCredentialRef.startsWith('profile:')) return sourceCredentialRef

    const suffix = sourceCredentialRef.includes(':password') ? ':password' : ':key'
    const credentialRef = `profile:${newProfileId}${suffix}`
    await secretBackendService.store(credentialRef, secret)
    return credentialRef
  }

  private async storeProfileSecret(
    backend: 'local' | 'vault',
    profileId: string,
    material: 'password' | 'privateKey',
    secret: string
  ): Promise<string> {
    const credentialRef =
      backend === 'vault'
        ? makeProfileCredentialRef('vault', profileId, material, this.vaultOptions())
        : makeProfileCredentialRef('local', profileId, material)
    await secretBackendService.store(credentialRef, secret)
    return credentialRef
  }

  async createProfile(input: ProfileInput): Promise<ConnectionProfile> {
    const id = nanoid()
    let credentialRef = input.credentialRef ?? null
    const backend = this.resolveSecretBackend(input)

    if (input.password) {
      credentialRef = await this.storeProfileSecret(backend, id, 'password', input.password)
    } else if (input.privateKey) {
      credentialRef = await this.storeProfileSecret(backend, id, 'privateKey', input.privateKey)
    } else if (input.cloneFromProfileId) {
      const source = this.getProfile(input.cloneFromProfileId)
      if (source) {
        credentialRef = await this.copyCredentialRefForProfile(source.credentialRef, id)
      }
    }

    getDatabase()
      .prepare(
        `INSERT INTO connection_profiles (id, host_id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.protocol,
        input.shell ?? null,
        input.username ?? null,
        input.authMethod ?? 'password',
        credentialRef,
        input.jumpHostId ?? null,
        JSON.stringify(input.extra ?? {})
      )

    if (input.linkHostId) {
      this.linkHostProfile(input.linkHostId, id)
    }

    return this.getProfile(id)!
  }

  async updateProfile(id: string, input: Partial<ProfileInput>): Promise<ConnectionProfile> {
    const existing = this.getProfile(id)
    if (!existing) throw new Error(`Profile not found: ${id}`)

    let credentialRef = input.credentialRef !== undefined ? input.credentialRef : existing.credentialRef
    const backend = this.resolveSecretBackend(input)
    if (input.password) {
      await this.deleteCredentialRef(existing.credentialRef)
      credentialRef = await this.storeProfileSecret(backend, id, 'password', input.password)
    } else if (input.privateKey) {
      await this.deleteCredentialRef(existing.credentialRef)
      credentialRef = await this.storeProfileSecret(backend, id, 'privateKey', input.privateKey)
    }

    getDatabase()
      .prepare(
        `UPDATE connection_profiles SET name=?, protocol=?, shell=?, username=?, auth_method=?, credential_ref=?, jump_host_id=?, extra_json=? WHERE id=?`
      )
      .run(
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

  async deleteProfile(id: string): Promise<void> {
    const existing = this.getProfile(id)
    if (existing?.credentialRef) {
      await this.deleteCredentialRef(existing.credentialRef)
    }
    getDatabase().prepare('DELETE FROM connection_profiles WHERE id = ?').run(id)
  }

  async duplicateProfile(
    sourceId: string,
    targetHostId?: string,
    name?: string
  ): Promise<ConnectionProfile> {
    const source = this.getProfile(sourceId)
    if (!source) throw new Error(`Profile not found: ${sourceId}`)

    const id = nanoid()
    const credentialRef = await this.copyCredentialRefForProfile(source.credentialRef, id)
    const profileName = name ?? `${source.name} (copy)`

    getDatabase()
      .prepare(
        `INSERT INTO connection_profiles (id, host_id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        profileName,
        source.protocol,
        source.shell,
        source.username,
        source.authMethod,
        credentialRef,
        source.jumpHostId,
        JSON.stringify(source.extra ?? {})
      )

    if (targetHostId) {
      this.linkHostProfile(targetHostId, id)
    }

    return this.getProfile(id)!
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
      if (parsed && 'layout' in parsed) {
        return {
          layout: parsed.layout,
          panes: (parsed.panes ?? []).map((pane) => this.migratePaneBinding(pane))
        }
      }
    } catch {
      /* fall through */
    }
    return { layout: null, panes: [] }
  }

  private migratePaneBinding(raw: PaneBinding): PaneBinding {
    let connectRequest: OpenSessionRequest = raw.connectRequest ?? {}
    if (!raw.connectRequest && raw.sessionId) {
      const snap = this.getSessionSnapshot(raw.sessionId)
      if (snap) {
        connectRequest = {
          hostId: snap.hostId ?? undefined,
          profileId: snap.profileId ?? undefined,
          protocol: snap.protocol as OpenSessionRequest['protocol'],
          title: snap.title
        }
      }
    }
    if (!connectRequest.title && raw.title) {
      connectRequest = { ...connectRequest, title: raw.title }
    }
    return {
      paneId: raw.paneId,
      sessionId: null,
      protocol: raw.protocol,
      title: raw.title,
      connectRequest
    }
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
