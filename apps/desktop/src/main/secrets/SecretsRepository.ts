import { getDatabase } from '../db/database'

export interface EncryptedSecretRecord {
  ref: string
  encryptedBlob: string
}

export class SecretsRepository {
  listAllEncrypted(): EncryptedSecretRecord[] {
    const rows = getDatabase().prepare('SELECT ref, encrypted_blob FROM vault_secrets').all()
    return (rows as Array<{ ref: string; encrypted_blob: string }>).map((r) => ({
      ref: r.ref,
      encryptedBlob: r.encrypted_blob
    }))
  }

  replaceAll(items: EncryptedSecretRecord[]): void {
    const db = getDatabase()
    db.prepare('DELETE FROM vault_secrets').run()
    const insert = db.prepare(
      'INSERT INTO vault_secrets (ref, encrypted_blob) VALUES (?, ?)'
    )
    for (const item of items) {
      insert.run(item.ref, item.encryptedBlob)
    }
  }
}

export const secretsRepository = new SecretsRepository()
