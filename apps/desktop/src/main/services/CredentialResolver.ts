import { applyAuthToConnectConfig } from '@consoleri/core'
import type { ConnectionProfile, Host } from '../../shared/types'
import { credentialVault } from '../hosts/CredentialVault'

export interface ResolvedCredentials {
  username: string
  password?: string
  privateKey?: string
}

export class CredentialResolver {
  async resolveForProfile(profile: ConnectionProfile): Promise<ResolvedCredentials> {
    const username = profile.username ?? ''
    if (!profile.credentialRef) {
      return { username }
    }
    const secret = await credentialVault.retrieve(profile.credentialRef)
    if (!secret) {
      throw new Error(
        `Could not load credentials for profile "${profile.name}". Check OS secure storage availability.`
      )
    }
    const auth = applyAuthToConnectConfig(profile.credentialRef, secret)
    return { username, ...auth }
  }

  async resolvePassword(profile: ConnectionProfile): Promise<string | null> {
    if (!profile.credentialRef) return null
    return credentialVault.retrieve(profile.credentialRef)
  }
}

export const credentialResolver = new CredentialResolver()

export function findSshProfile(
  profiles: ConnectionProfile[],
  profileId?: string | null
): ConnectionProfile | null {
  if (profileId) {
    const found = profiles.find((p) => p.id === profileId)
    if (found) return found
  }
  return profiles.find((p) => p.protocol === 'ssh') ?? null
}

export function resolveHostAndProfile(
  hostId: string | undefined,
  profileId: string | undefined,
  getHost: (id: string) => Host | null,
  listProfiles: (hostId: string) => ConnectionProfile[]
): { host: Host | null; profile: ConnectionProfile | null } {
  const profile = profileId ? listProfiles(hostId ?? '').find((p) => p.id === profileId) ?? null : null
  const host = hostId
    ? getHost(hostId)
    : profile?.hostId
      ? getHost(profile.hostId)
      : null

  if (host && !profile) {
    const profiles = listProfiles(host.id)
    return { host, profile: profiles[0] ?? null }
  }
  return { host, profile: profile ?? (host ? listProfiles(host.id)[0] ?? null : null) }
}
