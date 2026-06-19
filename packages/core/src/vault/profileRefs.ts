import { makeVaultKv2Ref } from '../keys/credentialRef'
import type { SecretBackendKind } from './types'

export type ProfileCredentialMaterial = 'password' | 'privateKey'

export function vaultFieldForMaterial(material: ProfileCredentialMaterial): string {
  return material === 'privateKey' ? 'private_key' : 'password'
}

export function makeProfileLocalRef(profileId: string, material: ProfileCredentialMaterial): string {
  return material === 'privateKey' ? `profile:${profileId}:key` : `profile:${profileId}:password`
}

export function makeProfileVaultRef(
  mount: string,
  prefix: string,
  profileId: string,
  material: ProfileCredentialMaterial
): string {
  const path = `${prefix.replace(/^\/+|\/+$/g, '')}/profiles/${profileId}`
  return makeVaultKv2Ref(mount, path, vaultFieldForMaterial(material))
}

export function makeProfileCredentialRef(
  backend: SecretBackendKind,
  profileId: string,
  material: ProfileCredentialMaterial,
  vault?: { mount: string; prefix: string }
): string {
  if (backend === 'vault') {
    if (!vault) throw new Error('Vault settings required for vault backend')
    return makeProfileVaultRef(vault.mount, vault.prefix, profileId, material)
  }
  return makeProfileLocalRef(profileId, material)
}

export function vaultPathForProfile(prefix: string, profileId: string): string {
  return `${prefix.replace(/^\/+|\/+$/g, '')}/profiles/${profileId}`
}
