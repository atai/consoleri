import type {
  GroupCreateFromExport,
  GroupExportItem,
  HostCreateFromExport,
  HostExportItem,
  HostProfileLinkExport,
  HostRelationPatchFromExport,
  ProfileCreateFromExport,
  ProfileExportItem
} from './types'

export function remapExportId(
  exportId: string | null | undefined,
  idMap: ReadonlyMap<string, string>
): string | null {
  if (!exportId) return null
  return idMap.get(exportId) ?? null
}

export function remapExportIds(
  exportIds: readonly string[],
  idMap: ReadonlyMap<string, string>
): string[] {
  return exportIds
    .map((id) => idMap.get(id))
    .filter((id): id is string => Boolean(id))
}

export function resolveUxProfileIdForImport(
  uxProfileId: string | null,
  validUxProfileIds: ReadonlySet<string>
): string | null {
  if (!uxProfileId) return null
  return validUxProfileIds.has(uxProfileId) ? uxProfileId : null
}

export function groupCreateFromExportItem(
  group: GroupExportItem,
  groupIdMap: ReadonlyMap<string, string>
): GroupCreateFromExport {
  return {
    exportId: group.exportId,
    name: group.name,
    parentId: remapExportId(group.parentId, groupIdMap),
    sortOrder: group.sortOrder
  }
}

export function hostCreateFromExportItem(
  host: HostExportItem,
  groupIdMap: ReadonlyMap<string, string>,
  validUxProfileIds: ReadonlySet<string>
): HostCreateFromExport {
  return {
    exportId: host.exportId,
    input: {
      name: host.name,
      hostname: host.hostname,
      port: host.port,
      osType: host.osType,
      tags: host.tags,
      groupId: remapExportId(host.groupId, groupIdMap),
      notes: host.notes,
      uxProfileId: resolveUxProfileIdForImport(host.uxProfileId, validUxProfileIds),
      logVerbosity: host.logVerbosity,
      httpEndpoint: host.httpEndpoint
    }
  }
}

export function hostRelationPatchFromExportItem(
  host: HostExportItem,
  hostIdMap: ReadonlyMap<string, string>,
  profileIdMap: ReadonlyMap<string, string>
): HostRelationPatchFromExport | null {
  const relatedHostIds = remapExportIds(host.relatedHostIds, hostIdMap)
  const gatewayHostId = remapExportId(host.gatewayHostId, hostIdMap)
  const defaultProfileId = remapExportId(host.defaultProfileId, profileIdMap)

  if (
    relatedHostIds.length === 0 &&
    gatewayHostId === null &&
    defaultProfileId === null
  ) {
    return null
  }

  return {
    exportId: host.exportId,
    patch: {
      relatedHostIds,
      gatewayHostId,
      defaultProfileId
    }
  }
}

export function profileCreateFromExportItem(
  profile: ProfileExportItem,
  hostIdMap: ReadonlyMap<string, string>
): ProfileCreateFromExport {
  return {
    exportId: profile.exportId,
    input: {
      name: profile.name,
      protocol: profile.protocol,
      shell: profile.shell,
      username: profile.username,
      authMethod: profile.authMethod,
      credentialRef: profile.credentialRef,
      jumpHostId: remapExportId(profile.jumpHostId, hostIdMap),
      extra: profile.extra
    }
  }
}

export function resolveHostProfileLink(
  link: HostProfileLinkExport,
  hostIdMap: ReadonlyMap<string, string>,
  profileIdMap: ReadonlyMap<string, string>
): { hostId: string; profileId: string } | null {
  const hostId = hostIdMap.get(link.hostId)
  const profileId = profileIdMap.get(link.profileId)
  if (!hostId || !profileId) return null
  return { hostId, profileId }
}
