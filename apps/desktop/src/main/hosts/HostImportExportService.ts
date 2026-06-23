import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import {
  buildHostsExportDocument,
  groupCreateFromExportItem,
  hostCreateFromExportItem,
  hostRelationPatchFromExportItem,
  parseHostsImportPayload,
  profileCreateFromExportItem,
  resolveHostProfileLink,
  serializeHostsExportDocument,
  sortGroupsForImport,
  type HostsExportDocument
} from '@consoleri/core'
import type { Host } from '../../shared/types'
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
}
