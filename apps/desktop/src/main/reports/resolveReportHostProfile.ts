import type { ConnectionProfile } from '../../shared/types'
import type { Host } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'

export type ResolvedReportHostProfile =
  | { ok: true; host: Host; profile: ConnectionProfile }
  | { ok: false; error: string; log: string[] }

export function resolveReportHostProfile(
  hostId: string,
  profileId: string
): ResolvedReportHostProfile {
  const host = hostRepository.getHost(hostId)
  if (!host) {
    return {
      ok: false,
      error: 'Host not found',
      log: ['Host not found']
    }
  }

  const profiles = hostRepository.listProfiles(host.id)
  const profile = profiles.find((p) => p.id === profileId)
  if (!profile) {
    return {
      ok: false,
      error: 'Profile not found for this host',
      log: ['Profile not found for this host']
    }
  }

  return { ok: true, host, profile }
}
