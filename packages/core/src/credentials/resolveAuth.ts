import { isKeyFileRef, isVaultRef, parseVaultRef } from '../keys/credentialRef'

export type AuthMaterialType = 'password' | 'privateKey' | 'none'

function authTypeFromVaultField(field: string): AuthMaterialType {
  if (field === 'private_key' || field === 'privateKey') return 'privateKey'
  return 'password'
}

export function authTypeFromCredentialRef(credentialRef: string | null): AuthMaterialType {
  if (!credentialRef) return 'none'
  if (isKeyFileRef(credentialRef)) return 'privateKey'
  if (isVaultRef(credentialRef)) {
    return authTypeFromVaultField(parseVaultRef(credentialRef).field)
  }
  if (credentialRef.includes(':key')) return 'privateKey'
  return 'password'
}

export function applyAuthToConnectConfig(
  credentialRef: string | null,
  secret: string | null
): { password?: string; privateKey?: string } {
  if (!secret || !credentialRef) return {}
  const type = authTypeFromCredentialRef(credentialRef)
  if (type === 'privateKey') return { privateKey: secret }
  if (type === 'password') return { password: secret }
  return {}
}
