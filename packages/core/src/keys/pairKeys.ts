import { isSshDirSkipName } from './sshDirArtifacts'
import { isEncryptedPrivateKey, looksLikePrivateKeyContent } from './detectPrivateKey'
import { parsePublicKeyFile } from './parsePublicKey'
import { labelFromKeyPath } from './credentialRef'

export type SshKeySource = 'ssh_dir' | 'custom'

export interface SshKeyDescriptor {
  id: string
  label: string
  privateKeyPath: string
  publicKeyPath: string | null
  fingerprint: string | null
  keyType: string | null
  encrypted: boolean
  source: SshKeySource
  exists: boolean
}

export interface ScanKeyFileInput {
  privateKeyPath: string
  privateContent: string
  publicKeyPath: string | null
  publicContent: string | null
  source: SshKeySource
  id: string
  label?: string
}

export function buildKeyDescriptor(input: ScanKeyFileInput): SshKeyDescriptor | null {
  if (!looksLikePrivateKeyContent(input.privateContent)) return null

  const parsed = input.publicContent ? parsePublicKeyFile(input.publicContent) : null

  return {
    id: input.id,
    label: input.label ?? labelFromKeyPath(input.privateKeyPath),
    privateKeyPath: input.privateKeyPath,
    publicKeyPath: input.publicKeyPath,
    fingerprint: parsed?.fingerprint ?? null,
    keyType: parsed?.keyType ?? null,
    encrypted: isEncryptedPrivateKey(input.privateContent),
    source: input.source,
    exists: true
  }
}

export function shouldScanAsPrivateKey(filename: string, content: string): boolean {
  if (isSshDirSkipName(filename)) return false
  return looksLikePrivateKeyContent(content)
}
