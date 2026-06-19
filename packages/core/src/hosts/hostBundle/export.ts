import { isKeyFileRef } from '../../keys/credentialRef'
import type { ConnectionProfile, Host } from '../../types'
import type {
  GroupExportItem,
  HostExportItem,
  HostGroupLike,
  HostProfileLinkExport,
  HostsExportDocument,
  ProfileExportItem
} from './types'
import { HOSTS_BUNDLE_VERSION } from './types'

export function sanitizeCredentialRefForExport(credentialRef: string | null): string | null {
  if (!credentialRef) return null
  if (isKeyFileRef(credentialRef)) return credentialRef
  if (credentialRef.startsWith('profile:')) return null
  return credentialRef
}

export function hostToExportItem(host: Host): HostExportItem {
  const { id, createdAt, updatedAt, ...data } = host
  return { exportId: id, ...data }
}

export function profileToExportItem(profile: ConnectionProfile): ProfileExportItem {
  const { id, credentialRef, ...data } = profile
  return {
    exportId: id,
    ...data,
    credentialRef: sanitizeCredentialRefForExport(credentialRef)
  }
}

export function groupToExportItem(group: HostGroupLike): GroupExportItem {
  const { id, ...data } = group
  return { exportId: id, ...data }
}

export function buildHostsExportDocument(
  groups: HostGroupLike[],
  hosts: Host[],
  profiles: ConnectionProfile[],
  links: HostProfileLinkExport[],
  exportedAt: string = new Date().toISOString()
): HostsExportDocument {
  return {
    version: HOSTS_BUNDLE_VERSION,
    exportedAt,
    groups: groups.map(groupToExportItem),
    hosts: hosts.map(hostToExportItem),
    profiles: profiles.map(profileToExportItem),
    links: links.map((link) => ({
      hostId: link.hostId,
      profileId: link.profileId
    }))
  }
}

export function serializeHostsExportDocument(doc: HostsExportDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}
