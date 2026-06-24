import { dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import {
  buildHostsExportDocument,
  groupCreateFromExportItem,
  hostCreateFromExportItem,
  hostRelationPatchFromExportItem,
  normalizeHostLogVerbosity,
  parseHostsImportPayload,
  profileCreateFromExportItem,
  resolveHostProfileLink,
  serializeHostsExportDocument,
  sortGroupsForImport,
  type HostsExportDocument
} from '@consoleri/core'
import type { Host } from '../../shared/types'
import { getDatabase } from '../db/database'
import { uxProfileRepository } from '../ux/UxProfileRepository'
import type { HostRepository } from './HostRepository'
import type { ProfileRepository } from './ProfileRepository'

export class HostImportExportService {
  constructor(
    private readonly hostRepo: HostRepository,
    private readonly profileRepo: ProfileRepository
  ) {}

  exportHostsBundle(): HostsExportDocument {
    const groups = this.hostRepo.listGroups()
    const hosts = this.hostRepo.listHosts()
    const profiles = this.profileRepo.listProfiles()
    const links = this.profileRepo.listAllProfileLinks()
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

  importHosts(payload: unknown): Promise<Host[]> {
    const doc = parseHostsImportPayload(payload)
    return this.importHostsBundle(doc)
  }

  async importHostsFromFile(): Promise<{ hosts: Host[] } | { canceled: true }> {
    const result = await dialog.showOpenDialog({
      title: 'Import hosts JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const raw = readFileSync(result.filePaths[0], 'utf8')
    const doc = parseHostsImportPayload(raw)
    const hosts = await this.importHostsBundle(doc)
    return { hosts }
  }

  async importHostsBundle(doc: HostsExportDocument): Promise<Host[]> {
    const groupIdMap = new Map<string, string>()
    const hostIdMap = new Map<string, string>()
    const profileIdMap = new Map<string, string>()
    const createdHosts: Host[] = []
    const validUxProfileIds = new Set(uxProfileRepository.list().map((profile) => profile.id))

    for (const group of sortGroupsForImport(doc.groups)) {
      const planned = groupCreateFromExportItem(group, groupIdMap)
      const created = this.hostRepo.createGroup(planned.name, planned.parentId, planned.sortOrder)
      groupIdMap.set(planned.exportId, created.id)
    }

    for (const host of doc.hosts) {
      const planned = hostCreateFromExportItem(host, groupIdMap, validUxProfileIds)
      const created = this.hostRepo.createHost(planned.input)
      hostIdMap.set(planned.exportId, created.id)
      createdHosts.push(created)
    }

    for (const profile of doc.profiles) {
      const planned = profileCreateFromExportItem(profile, hostIdMap)
      const created = await this.profileRepo.createProfile(planned.input)
      profileIdMap.set(planned.exportId, created.id)
    }

    for (const link of doc.links) {
      const resolved = resolveHostProfileLink(link, hostIdMap, profileIdMap)
      if (resolved) {
        this.profileRepo.linkHostProfile(resolved.hostId, resolved.profileId)
      }
    }

    for (const host of doc.hosts) {
      const hostId = hostIdMap.get(host.exportId)
      if (!hostId) continue

      const patch = hostRelationPatchFromExportItem(host, hostIdMap, profileIdMap)
      if (patch) {
        this.hostRepo.updateHost(hostId, patch.patch)
      }
    }

    return createdHosts.map((host) => this.hostRepo.getHost(host.id) ?? host)
  }

  /**
   * Full-replace import: clear all existing hosts/groups/profiles/links and
   * re-insert with original IDs preserved (used by full-app restore).
   */
  importHostsBundleReplace(doc: HostsExportDocument): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    const validUxProfileIds = new Set(uxProfileRepository.list().map((p) => p.id))

    db.exec(
      'DELETE FROM host_profile_links; DELETE FROM connection_profiles; DELETE FROM hosts; DELETE FROM host_groups'
    )

    for (const group of sortGroupsForImport(doc.groups)) {
      const parentId = group.parentId ?? null
      db.prepare(
        'INSERT INTO host_groups (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)'
      ).run(group.exportId, group.name, parentId, group.sortOrder)
    }

    for (const host of doc.hosts) {
      const uxProfileId = validUxProfileIds.has(host.uxProfileId ?? '')
        ? host.uxProfileId
        : null
      db.prepare(
        `INSERT INTO hosts (id, name, hostname, port, os_type, tags_json, group_id, notes,
          default_profile_id, ux_profile_id, log_verbosity, related_hosts_json,
          gateway_host_id, http_endpoint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        host.exportId,
        host.name,
        host.hostname,
        host.port,
        host.osType,
        JSON.stringify(host.tags),
        host.groupId ?? null,
        host.notes,
        host.defaultProfileId ?? null,
        uxProfileId,
        normalizeHostLogVerbosity(host.logVerbosity),
        JSON.stringify(host.relatedHostIds),
        host.gatewayHostId ?? null,
        host.httpEndpoint ?? null,
        now,
        now
      )
    }

    for (const profile of doc.profiles) {
      db.prepare(
        `INSERT INTO connection_profiles
           (id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        profile.exportId,
        profile.name,
        profile.protocol,
        profile.shell ?? null,
        profile.username ?? null,
        profile.authMethod,
        profile.credentialRef ?? null,
        profile.jumpHostId ?? null,
        JSON.stringify(profile.extra ?? {})
      )
    }

    for (const link of doc.links) {
      db.prepare(
        'INSERT OR IGNORE INTO host_profile_links (host_id, profile_id) VALUES (?, ?)'
      ).run(link.hostId, link.profileId)
    }
  }
}
