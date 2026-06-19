import { safeStorage } from 'electron'
import { getDatabase } from '../db/database'

const SECURE_REFS = {
  vaultToken: 'vault:auth:token',
  approleSecretId: 'vault:auth:approle:secret_id',
  oidcRefreshToken: 'vault:auth:oidc:refresh_token'
} as const

export class VaultSecureStorage {
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

  storeToken(token: string): Promise<void> {
    return this.store(SECURE_REFS.vaultToken, token)
  }

  getToken(): Promise<string | null> {
    return this.retrieve(SECURE_REFS.vaultToken)
  }

  deleteToken(): Promise<void> {
    return this.delete(SECURE_REFS.vaultToken)
  }

  storeAppRoleSecretId(secretId: string): Promise<void> {
    return this.store(SECURE_REFS.approleSecretId, secretId)
  }

  getAppRoleSecretId(): Promise<string | null> {
    return this.retrieve(SECURE_REFS.approleSecretId)
  }

  deleteAppRoleSecretId(): Promise<void> {
    return this.delete(SECURE_REFS.approleSecretId)
  }

  storeOidcRefreshToken(token: string): Promise<void> {
    return this.store(SECURE_REFS.oidcRefreshToken, token)
  }

  getOidcRefreshToken(): Promise<string | null> {
    return this.retrieve(SECURE_REFS.oidcRefreshToken)
  }

  deleteOidcRefreshToken(): Promise<void> {
    return this.delete(SECURE_REFS.oidcRefreshToken)
  }
}

export const vaultSecureStorage = new VaultSecureStorage()
