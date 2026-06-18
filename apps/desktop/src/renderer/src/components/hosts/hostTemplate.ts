import type { ConnectionProfile, Host, HostInput } from '@shared/types'
import { newPendingKey, type PendingProfile } from './pendingProfiles'

export function hostCopyName(source: Host): string {
  return `${source.name} (copy)`
}

export function hostInputFromCopy(source: Host): HostInput {
  return {
    name: hostCopyName(source),
    hostname: source.hostname,
    port: source.port,
    osType: source.osType,
    tags: [...source.tags],
    groupId: source.groupId,
    notes: source.notes,
    defaultProfileId: source.defaultProfileId,
    uxProfileId: source.uxProfileId,
    logVerbosity: source.logVerbosity,
    relatedHostIds: [...source.relatedHostIds],
    gatewayHostId: source.gatewayHostId,
    httpEndpoint: source.httpEndpoint
  }
}

export function pendingProfilesFromHost(profiles: ConnectionProfile[]): PendingProfile[] {
  return profiles.map((profile) => ({
    key: newPendingKey(),
    kind: 'picked' as const,
    profile
  }))
}
