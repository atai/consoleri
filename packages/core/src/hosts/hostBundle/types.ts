import type { AuthMethod, OsType, Protocol } from '../../types'
import type { normalizeHostLogVerbosity } from '../../logging/verbosity'

export const HOSTS_BUNDLE_VERSION = 1

export interface HostGroupLike {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

export interface GroupExportItem {
  exportId: string
  name: string
  parentId: string | null
  sortOrder: number
}

export interface HostExportItem {
  exportId: string
  name: string
  hostname: string
  port: number
  osType: OsType
  tags: string[]
  groupId: string | null
  notes: string
  defaultProfileId: string | null
  uxProfileId: string | null
  logVerbosity: ReturnType<typeof normalizeHostLogVerbosity>
  relatedHostIds: string[]
  gatewayHostId: string | null
  httpEndpoint: string | null
}

export interface ProfileExportItem {
  exportId: string
  name: string
  protocol: Protocol
  shell: string | null
  username: string | null
  authMethod: AuthMethod
  credentialRef: string | null
  jumpHostId: string | null
  extra: Record<string, unknown>
}

export interface HostProfileLinkExport {
  hostId: string
  profileId: string
}

export interface HostsExportDocument {
  version: typeof HOSTS_BUNDLE_VERSION
  exportedAt: string
  groups: GroupExportItem[]
  hosts: HostExportItem[]
  profiles: ProfileExportItem[]
  links: HostProfileLinkExport[]
}

export interface HostCreateFromExport {
  exportId: string
  input: {
    name: string
    hostname: string
    port: number
    osType: OsType
    tags: string[]
    groupId: string | null
    notes: string
    uxProfileId: string | null
    logVerbosity: HostExportItem['logVerbosity']
    httpEndpoint: string | null
  }
}

export interface HostRelationPatchFromExport {
  exportId: string
  patch: {
    relatedHostIds: string[]
    gatewayHostId: string | null
    defaultProfileId: string | null
  }
}

export interface ProfileCreateFromExport {
  exportId: string
  input: {
    name: string
    protocol: Protocol
    shell: string | null
    username: string | null
    authMethod: AuthMethod
    credentialRef: string | null
    jumpHostId: string | null
    extra: Record<string, unknown>
  }
}

export interface GroupCreateFromExport {
  exportId: string
  name: string
  parentId: string | null
  sortOrder: number
}
