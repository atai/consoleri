import { nanoid } from 'nanoid'
import {
  normalizeHostLogVerbosity,
  normalizeGatewayHostId,
  normalizeHttpEndpoint,
  normalizeRelatedHostIds,
  rowToHost
} from '@consoleri/core'
import type {
  Host,
  HostFilter,
  HostGroup,
  HostInput
} from '../../shared/types'
import { getDatabase } from '../db/database'

/**
 * Manages hosts and host groups.
 *
 * Profile operations → ProfileRepository
 * Workspace operations → WorkspaceRepository
 * Import/export operations → HostImportExportService
 */
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
}

export const hostRepository = new HostRepository()
