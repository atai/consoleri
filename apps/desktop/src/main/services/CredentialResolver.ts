import {
  applyAuthToConnectConfig,
  authTypeFromCredentialRef,
  isKeyFileRef,
  isVaultRef,
  keyFilePassphraseRef,
  keyPathFromRef,
  makeProfileCredentialRef,
  type SecretBackendKind
} from '@consoleri/core'
import { readFileSync } from 'fs'
import type { ConnectionProfile, Host } from '../../shared/types'
import { secretBackendService } from '../secrets/SecretBackendService'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'

export interface ResolvedCredentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

export class CredentialResolver {
  async resolveForProfile(profile: ConnectionProfile): Promise<ResolvedCredentials> {
    const username = profile.username ?? ''
    if (!profile.credentialRef) {
      return { username }
    }

    if (isKeyFileRef(profile.credentialRef)) {
      const keyPath = keyPathFromRef(profile.credentialRef)
      let privateKey: string
      try {
        privateKey = readFileSync(keyPath, 'utf8')
      } catch {
        throw new Error(`Could not read SSH key file: ${keyPath}`)
      }
      const passphrase =
        (await secretBackendService.retrieve(keyFilePassphraseRef(keyPath))) ?? undefined
      return { username, privateKey, passphrase }
    }

    const secret = await secretBackendService.retrieve(profile.credentialRef)
    if (!secret) {
      const backendHint = isVaultRef(profile.credentialRef)
        ? 'Check Vault connectivity and permissions.'
        : 'Check OS secure storage availability.'
      throw new Error(
        `Could not load credentials for profile "${profile.name}". ${backendHint}`
      )
    }
    const auth = applyAuthToConnectConfig(profile.credentialRef, secret)
    return { username, ...auth }
  }

  async resolvePassword(profile: ConnectionProfile): Promise<string | null> {
    if (!profile.credentialRef) return null
    const secret = await secretBackendService.retrieve(profile.credentialRef)
    if (!secret) return null
    const authType = authTypeFromCredentialRef(profile.credentialRef)
    return authType === 'password' ? secret : null
  }

  vaultOptionsForBackend(): { mount: string; prefix: string } {
    const settings = vaultSettingsRepository.getSettings()
    return {
      mount: settings.defaultKvMount,
      prefix: settings.secretPathPrefix
    }
  }

  makeCredentialRef(
    backend: SecretBackendKind,
    profileId: string,
    material: 'password' | 'privateKey'
  ): string {
    if (backend === 'vault') {
      return makeProfileCredentialRef(backend, profileId, material, this.vaultOptionsForBackend())
    }
    return makeProfileCredentialRef(backend, profileId, material)
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
  const host = hostId ? getHost(hostId) : null

  if (!host) {
    return { host, profile }
  }

  const profiles = listProfiles(host.id)
  const defaultProfile = host.defaultProfileId
    ? profiles.find((p) => p.id === host.defaultProfileId) ?? null
    : null

  return {
    host,
    profile: profile ?? defaultProfile ?? profiles[0] ?? null
  }
}
