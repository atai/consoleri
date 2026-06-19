import { safeStorage } from 'electron'
import { isVaultRef } from '@consoleri/core'
import { getDatabase } from '../db/database'
import type { SecretBackend } from './SecretBackend'

export class LocalSecretBackend implements SecretBackend {
  readonly id = 'local' as const

  canHandle(ref: string): boolean {
    return !isVaultRef(ref)
  }

  async store(ref: string, secret: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS secure storage is not available')
    }
    const encrypted = safeStorage.encryptString(secret).toString('base64')
    getDatabase()
      .prepare(`INSERT OR REPLACE INTO vault_secrets (ref, encrypted_blob) VALUES (?, ?)`)
      .run(ref, encrypted)
  }

  async retrieve(ref: string): Promise<string | null> {
    const row = getDatabase()
      .prepare(`SELECT encrypted_blob FROM vault_secrets WHERE ref = ?`)
      .get(ref) as { encrypted_blob: string } | undefined
    if (!row || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(Buffer.from(row.encrypted_blob, 'base64'))
  }

  async delete(ref: string): Promise<void> {
    getDatabase().prepare(`DELETE FROM vault_secrets WHERE ref = ?`).run(ref)
  }
}

export const localSecretBackend = new LocalSecretBackend()
