import { isKeyFileRef } from '../keys/credentialRef'

export type AuthMaterialType = 'password' | 'privateKey' | 'none'

export function authTypeFromCredentialRef(credentialRef: string | null): AuthMaterialType {
  if (!credentialRef) return 'none'
  if (isKeyFileRef(credentialRef)) return 'privateKey'
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
