import { nanoid } from 'nanoid'
import {
  authTypeFromCredentialRef,
  isKeyFileRef,
  isVaultRef,
  makeProfileCredentialRef,
  rowToHost,
  rowToProfile
} from '@consoleri/core'
import type {
  ConnectionProfile,
  Host,
  ProfileInput
} from '../../shared/types'
import { getDatabase } from '../db/database'
import { beginOperationLog } from '../logging/OperationLog'
import { secretBackendService } from '../secrets/SecretBackendService'
import {
  checkVaultKvWritePreflight,
  formatKvPreflightDenial,
  vaultDataPathFromRef
} from '../vault/VaultKvPreflight'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'
import type { HostProfileLinkExport } from '@consoleri/core'

export class ProfileRepository {
  // ── Private credential helpers ─────────────────────────────────────────────

  private vaultOptions() {
    const settings = vaultSettingsRepository.getSettings()
    return { mount: settings.defaultKvMount, prefix: settings.secretPathPrefix }
  }

  private resolveSecretBackend(input?: Partial<ProfileInput>): 'local' | 'vault' {
    return input?.secretBackend ?? vaultSettingsRepository.getDefaultBackend()
  }

  private async deleteCredentialRef(credentialRef: string | null): Promise<void> {
    if (!credentialRef || isKeyFileRef(credentialRef)) return
    try {
      await secretBackendService.delete(credentialRef)
    } catch {
      /* best effort cleanup */
    }
  }

  private async copyCredentialRefForProfile(
    sourceCredentialRef: string | null,
    newProfileId: string
  ): Promise<string | null> {
    if (!sourceCredentialRef) return null
    if (isKeyFileRef(sourceCredentialRef)) return sourceCredentialRef

    const secret = await secretBackendService.retrieve(sourceCredentialRef)
    if (!secret) return null

    if (isVaultRef(sourceCredentialRef)) {
      const material =
        authTypeFromCredentialRef(sourceCredentialRef) === 'privateKey' ? 'privateKey' : 'password'
      return this.storeProfileSecret('vault', newProfileId, material, secret, {
        fallbackLabel: 'Profile copy'
      })
    }

    if (!sourceCredentialRef.startsWith('profile:')) return sourceCredentialRef

    const suffix = sourceCredentialRef.includes(':password') ? ':password' : ':key'
    const credentialRef = `profile:${newProfileId}${suffix}`
    await secretBackendService.store(credentialRef, secret)
    return credentialRef
  }

  private async storeProfileSecret(
    backend: 'local' | 'vault',
    profileId: string,
    material: 'password' | 'privateKey',
    secret: string,
    logContext?: { hostId?: string; fallbackLabel?: string }
  ): Promise<string> {
    const credentialRef =
      backend === 'vault'
        ? makeProfileCredentialRef('vault', profileId, material, this.vaultOptions())
        : makeProfileCredentialRef('local', profileId, material)

    if (backend !== 'vault') {
      await secretBackendService.store(credentialRef, secret)
      return credentialRef
    }

    const op = beginOperationLog({
      kind: 'vault',
      profileId,
      hostId: logContext?.hostId,
      fallbackLabel: logContext?.fallbackLabel ?? 'Profile save'
    })
    const dataPath = vaultDataPathFromRef(credentialRef)
    op.log('info', `Storing ${material} to Vault path ${dataPath}`)

    const settings = vaultSettingsRepository.getSettings()
    const preflight = await checkVaultKvWritePreflight(settings, profileId)
    op.log(
      'debug',
      `Preflight ${preflight.dataPath}: [${preflight.dataCapabilities.join(', ') || 'none'}]`
    )
    if (!preflight.skipped && !preflight.allowed) {
      op.fail(formatKvPreflightDenial(preflight))
    }
    if (preflight.warning) {
      op.log('warn', preflight.warning)
    }

    try {
      await secretBackendService.store(credentialRef, secret)
      op.log('info', 'Vault secret stored successfully')
    } catch (error) {
      op.fail('Vault store failed', error)
    }

    return credentialRef
  }

  // ── Legacy link migration ─────────────────────────────────────────────────

  syncLegacyProfileLinks(): void {
    getDatabase().exec(`
      INSERT OR IGNORE INTO host_profile_links (host_id, profile_id)
      SELECT host_id, id FROM connection_profiles WHERE host_id IS NOT NULL
    `)
  }

  // ── Profile queries ───────────────────────────────────────────────────────

  getProfile(id: string): ConnectionProfile | null {
    const row = getDatabase().prepare('SELECT * FROM connection_profiles WHERE id = ?').get(id)
    return row ? rowToProfile(row as Record<string, unknown>) : null
  }

  listProfiles(hostId?: string): ConnectionProfile[] {
    this.syncLegacyProfileLinks()
    const db = getDatabase()
    const rows = hostId
      ? db
          .prepare(
            `SELECT p.* FROM connection_profiles p
             INNER JOIN host_profile_links l ON l.profile_id = p.id
             WHERE l.host_id = ?
             ORDER BY p.name`
          )
          .all(hostId)
      : db.prepare('SELECT * FROM connection_profiles ORDER BY name').all()
    return rows.map((r) => rowToProfile(r as Record<string, unknown>))
  }

  listHostsForProfile(profileId: string): Host[] {
    this.syncLegacyProfileLinks()
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT h.* FROM hosts h
         INNER JOIN host_profile_links l ON l.host_id = h.id
         WHERE l.profile_id = ?
         ORDER BY h.name COLLATE NOCASE`
      )
      .all(profileId)
    return rows.map((r) => rowToHost(r as Record<string, unknown>))
  }

  listAllProfileLinks(): HostProfileLinkExport[] {
    this.syncLegacyProfileLinks()
    const rows = getDatabase()
      .prepare('SELECT host_id, profile_id FROM host_profile_links')
      .all() as Array<{ host_id: string; profile_id: string }>
    return rows.map((row) => ({
      hostId: row.host_id,
      profileId: row.profile_id
    }))
  }

  linkHostProfile(hostId: string, profileId: string): void {
    const hostRow = getDatabase().prepare('SELECT id FROM hosts WHERE id = ?').get(hostId)
    if (!hostRow) throw new Error(`Host not found: ${hostId}`)
    const profile = this.getProfile(profileId)
    if (!profile) throw new Error(`Profile not found: ${profileId}`)
    getDatabase()
      .prepare('INSERT OR IGNORE INTO host_profile_links (host_id, profile_id) VALUES (?, ?)')
      .run(hostId, profileId)
  }

  unlinkHostProfile(hostId: string, profileId: string): void {
    getDatabase()
      .prepare('DELETE FROM host_profile_links WHERE host_id = ? AND profile_id = ?')
      .run(hostId, profileId)
  }

  isProfileLinkedToHost(hostId: string, profileId: string): boolean {
    const row = getDatabase()
      .prepare(
        'SELECT 1 FROM host_profile_links WHERE host_id = ? AND profile_id = ? LIMIT 1'
      )
      .get(hostId, profileId)
    return Boolean(row)
  }

  // ── Profile mutations ─────────────────────────────────────────────────────

  async createProfile(input: ProfileInput): Promise<ConnectionProfile> {
    const id = nanoid()
    let credentialRef = input.credentialRef ?? null
    const backend = this.resolveSecretBackend(input)

    if (input.password) {
      credentialRef = await this.storeProfileSecret(backend, id, 'password', input.password, {
        hostId: input.linkHostId,
        fallbackLabel: 'Profile save'
      })
    } else if (input.privateKey) {
      credentialRef = await this.storeProfileSecret(backend, id, 'privateKey', input.privateKey, {
        hostId: input.linkHostId,
        fallbackLabel: 'Profile save'
      })
    } else if (input.cloneFromProfileId) {
      const source = this.getProfile(input.cloneFromProfileId)
      if (source) {
        credentialRef = await this.copyCredentialRefForProfile(source.credentialRef, id)
      }
    }

    getDatabase()
      .prepare(
        `INSERT INTO connection_profiles (id, host_id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.protocol,
        input.shell ?? null,
        input.username ?? null,
        input.authMethod ?? 'password',
        credentialRef,
        input.jumpHostId ?? null,
        JSON.stringify(input.extra ?? {})
      )

    if (input.linkHostId) {
      this.linkHostProfile(input.linkHostId, id)
    }

    return this.getProfile(id)!
  }

  async updateProfile(id: string, input: Partial<ProfileInput>): Promise<ConnectionProfile> {
    const existing = this.getProfile(id)
    if (!existing) throw new Error(`Profile not found: ${id}`)

    let credentialRef = input.credentialRef !== undefined ? input.credentialRef : existing.credentialRef
    const backend = this.resolveSecretBackend(input)
    if (input.password) {
      await this.deleteCredentialRef(existing.credentialRef)
      credentialRef = await this.storeProfileSecret(backend, id, 'password', input.password, {
        hostId: existing.jumpHostId ?? undefined,
        fallbackLabel: 'Profile update'
      })
    } else if (input.privateKey) {
      await this.deleteCredentialRef(existing.credentialRef)
      credentialRef = await this.storeProfileSecret(backend, id, 'privateKey', input.privateKey, {
        hostId: existing.jumpHostId ?? undefined,
        fallbackLabel: 'Profile update'
      })
    }

    getDatabase()
      .prepare(
        `UPDATE connection_profiles SET name=?, protocol=?, shell=?, username=?, auth_method=?, credential_ref=?, jump_host_id=?, extra_json=? WHERE id=?`
      )
      .run(
        input.name ?? existing.name,
        input.protocol ?? existing.protocol,
        input.shell !== undefined ? input.shell : existing.shell,
        input.username !== undefined ? input.username : existing.username,
        input.authMethod ?? existing.authMethod,
        credentialRef,
        input.jumpHostId !== undefined ? input.jumpHostId : existing.jumpHostId,
        JSON.stringify(input.extra ?? existing.extra),
        id
      )
    return this.getProfile(id)!
  }

  async deleteProfile(id: string): Promise<void> {
    const existing = this.getProfile(id)
    if (existing?.credentialRef) {
      await this.deleteCredentialRef(existing.credentialRef)
    }
    getDatabase().prepare('DELETE FROM connection_profiles WHERE id = ?').run(id)
  }

  async duplicateProfile(
    sourceId: string,
    targetHostId?: string,
    name?: string
  ): Promise<ConnectionProfile> {
    const source = this.getProfile(sourceId)
    if (!source) throw new Error(`Profile not found: ${sourceId}`)

    const id = nanoid()
    const credentialRef = await this.copyCredentialRefForProfile(source.credentialRef, id)
    const profileName = name ?? `${source.name} (copy)`

    getDatabase()
      .prepare(
        `INSERT INTO connection_profiles (id, host_id, name, protocol, shell, username, auth_method, credential_ref, jump_host_id, extra_json)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        profileName,
        source.protocol,
        source.shell,
        source.username,
        source.authMethod,
        credentialRef,
        source.jumpHostId,
        JSON.stringify(source.extra ?? {})
      )

    if (targetHostId) {
      this.linkHostProfile(targetHostId, id)
    }

    return this.getProfile(id)!
  }
}

export const profileRepository = new ProfileRepository()
