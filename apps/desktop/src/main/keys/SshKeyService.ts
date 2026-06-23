import { existsSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { dialog } from 'electron'
import { nanoid } from 'nanoid'
import {
  buildKeyDescriptor,
  isSshDirSkipName,
  shouldScanAsPrivateKey,
  stableKeyId
} from '@consoleri/core/keys/node'
import { labelFromKeyPath, makeKeyFileRef, publicKeyPathForPrivate } from '@consoleri/core'
import type { AssignableHost, SshKeyInfo } from '../../shared/types'
import { getDatabase } from '../db/database'
import { hostRepository } from '../hosts/HostRepository'
import { profileRepository } from '../hosts/ProfileRepository'
import { secretBackendService } from '../secrets/SecretBackendService'

function readTextIfExists(path: string): string | null {
  if (!existsSync(path)) return null
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function descriptorFromPath(
  privatePath: string,
  source: 'ssh_dir' | 'custom',
  id: string,
  label?: string
): SshKeyInfo | null {
  const privateContent = readTextIfExists(privatePath)
  if (!privateContent) {
    return {
      id,
      label: label ?? labelFromKeyPath(privatePath),
      privateKeyPath: privatePath,
      publicKeyPath: null,
      fingerprint: null,
      keyType: null,
      encrypted: false,
      source,
      exists: false
    }
  }

  const pubPath = publicKeyPathForPrivate(privatePath)
  const publicContent = readTextIfExists(pubPath)

  const desc = buildKeyDescriptor({
    id,
    privateKeyPath: privatePath,
    publicKeyPath: publicContent ? pubPath : null,
    privateContent,
    publicContent,
    source,
    label
  })

  return desc
}

export class SshKeyService {
  listKeys(): SshKeyInfo[] {
    const byPath = new Map<string, SshKeyInfo>()

    const sshDir = join(homedir(), '.ssh')
    if (existsSync(sshDir)) {
      let entries: string[]
      try {
        entries = readdirSync(sshDir)
      } catch {
        entries = []
      }

      for (const name of entries) {
        if (isSshDirSkipName(name)) continue
        const privatePath = join(sshDir, name)
        const content = readTextIfExists(privatePath)
        if (!content || !shouldScanAsPrivateKey(name, content)) continue

        const desc = descriptorFromPath(privatePath, 'ssh_dir', stableKeyId(privatePath))
        if (desc) byPath.set(privatePath, desc)
      }
    }

    const customRows = getDatabase()
      .prepare('SELECT * FROM custom_ssh_keys ORDER BY created_at DESC')
      .all() as Array<{
      id: string
      label: string
      private_key_path: string
      public_key_path: string | null
    }>

    for (const row of customRows) {
      const privatePath = row.private_key_path
      if (byPath.has(privatePath)) continue

      const privateContent = readTextIfExists(privatePath)
      const pubPath = row.public_key_path ?? publicKeyPathForPrivate(privatePath)
      const publicContent = readTextIfExists(pubPath)

      if (!privateContent) {
        byPath.set(privatePath, {
          id: row.id,
          label: row.label,
          privateKeyPath: privatePath,
          publicKeyPath: row.public_key_path,
          fingerprint: null,
          keyType: null,
          encrypted: false,
          source: 'custom',
          exists: false
        })
        continue
      }

      const desc = buildKeyDescriptor({
        id: row.id,
        privateKeyPath: privatePath,
        publicKeyPath: publicContent ? pubPath : row.public_key_path,
        privateContent,
        publicContent,
        source: 'custom',
        label: row.label
      })
      if (desc) byPath.set(privatePath, desc)
    }

    const keys = Array.from(byPath.values())
    keys.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'ssh_dir' ? -1 : 1
      return a.label.localeCompare(b.label)
    })
    return keys
  }

  addCustomKey(privateKeyPath: string, label?: string): SshKeyInfo {
    const content = readTextIfExists(privateKeyPath)
    if (!content) throw new Error(`Key file not found: ${privateKeyPath}`)

    const desc = buildKeyDescriptor({
      id: nanoid(),
      privateKeyPath,
      publicKeyPath: null,
      privateContent: content,
      publicContent: readTextIfExists(publicKeyPathForPrivate(privateKeyPath)),
      source: 'custom',
      label: label ?? labelFromKeyPath(privateKeyPath)
    })
    if (!desc) throw new Error('File does not appear to be a valid SSH private key')

    const pubPath = desc.publicKeyPath
    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `INSERT INTO custom_ssh_keys (id, label, private_key_path, public_key_path, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(desc.id, desc.label, privateKeyPath, pubPath, now)

    return desc
  }

  removeCustomKey(id: string): void {
    getDatabase().prepare('DELETE FROM custom_ssh_keys WHERE id = ?').run(id)
  }

  async pickKeyFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Select SSH private key',
      properties: ['openFile'],
      filters: [
        { name: 'SSH keys', extensions: ['pem', 'key'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  async assignToProfile(profileId: string, keyPath: string): Promise<void> {
    const content = readTextIfExists(keyPath)
    if (!content) throw new Error(`Key file not found: ${keyPath}`)

    await profileRepository.updateProfile(profileId, {
      authMethod: 'key',
      credentialRef: makeKeyFileRef(keyPath)
    })
  }

  listAssignableHosts(): AssignableHost[] {
    const hosts = hostRepository.listHosts()
    const result: AssignableHost[] = []

    for (const host of hosts) {
      const profiles = profileRepository
        .listProfiles(host.id)
        .filter((p) => p.protocol === 'ssh')
        .map((p) => ({
          profileId: p.id,
          profileName: p.name,
          username: p.username,
          credentialRef: p.credentialRef
        }))

      if (profiles.length > 0) {
        result.push({
          hostId: host.id,
          hostName: host.name,
          hostname: host.hostname,
          profiles
        })
      }
    }

    return result
  }

  async storePassphrase(keyPath: string, passphrase: string): Promise<void> {
    await secretBackendService.store(`keyfile:${keyPath}:passphrase`, passphrase)
  }
}

export const sshKeyService = new SshKeyService()
