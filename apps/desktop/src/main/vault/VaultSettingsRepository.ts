import {
  DEFAULT_VAULT_SETTINGS,
  type VaultAuthConfig,
  type VaultSettings,
  type VaultSettingsUpdate,
  type VaultStatus
} from '@consoleri/core'
import { getDatabase } from '../db/database'
import { vaultAuthManager } from './VaultAuthManager'
import { vaultHealthCheck } from './vaultClient'
import { vaultSecureStorage } from './VaultSecureStorage'

const VAULT_SETTINGS_KEY = 'vault_settings'

function normalizeAuth(raw: unknown): VaultAuthConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_VAULT_SETTINGS.auth
  const value = raw as Record<string, unknown>
  const method = value.method
  if (method === 'approle') {
    return {
      method: 'approle',
      roleId: typeof value.roleId === 'string' ? value.roleId : '',
      mountPath: typeof value.mountPath === 'string' ? value.mountPath : 'approle',
      hasSecretId: Boolean(value.hasSecretId)
    }
  }
  if (method === 'oidc') {
    return {
      method: 'oidc',
      role: typeof value.role === 'string' ? value.role : '',
      mountPath: typeof value.mountPath === 'string' ? value.mountPath : 'oidc',
      hasRefreshToken: Boolean(value.hasRefreshToken)
    }
  }
  return {
    method: 'token',
    hasToken: Boolean(value.hasToken)
  }
}

function normalizeSettings(raw: unknown): VaultSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VAULT_SETTINGS }
  const value = raw as Record<string, unknown>
  return {
    enabled: Boolean(value.enabled),
    address: typeof value.address === 'string' ? value.address : '',
    namespace: typeof value.namespace === 'string' ? value.namespace : '',
    defaultKvMount:
      typeof value.defaultKvMount === 'string' && value.defaultKvMount.trim()
        ? value.defaultKvMount
        : DEFAULT_VAULT_SETTINGS.defaultKvMount,
    secretPathPrefix:
      typeof value.secretPathPrefix === 'string' && value.secretPathPrefix.trim()
        ? value.secretPathPrefix
        : DEFAULT_VAULT_SETTINGS.secretPathPrefix,
    defaultBackend: value.defaultBackend === 'vault' ? 'vault' : 'local',
    auth: normalizeAuth(value.auth),
    tlsSkipVerify: Boolean(value.tlsSkipVerify)
  }
}

export class VaultSettingsRepository {
  getSettings(): VaultSettings {
    const row = getDatabase()
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(VAULT_SETTINGS_KEY) as { value: string } | undefined
    if (!row?.value) return { ...DEFAULT_VAULT_SETTINGS }
    try {
      return normalizeSettings(JSON.parse(row.value))
    } catch {
      return { ...DEFAULT_VAULT_SETTINGS }
    }
  }

  private writeSettings(settings: VaultSettings): VaultSettings {
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(VAULT_SETTINGS_KEY, JSON.stringify(settings))
    return settings
  }

  async updateSettings(patch: VaultSettingsUpdate): Promise<VaultSettings> {
    const current = this.getSettings()
    let auth = current.auth

    if (patch.auth) {
      if (patch.auth.method === 'token') {
        auth = {
          method: 'token',
          hasToken: patch.auth.hasToken ?? (current.auth.method === 'token' ? current.auth.hasToken : false)
        }
      } else if (patch.auth.method === 'approle') {
        auth = {
          method: 'approle',
          roleId:
            'roleId' in patch.auth && typeof patch.auth.roleId === 'string'
              ? patch.auth.roleId
              : current.auth.method === 'approle'
                ? current.auth.roleId
                : '',
          mountPath:
            'mountPath' in patch.auth && typeof patch.auth.mountPath === 'string'
              ? patch.auth.mountPath
              : current.auth.method === 'approle'
                ? current.auth.mountPath
                : 'approle',
          hasSecretId:
            patch.auth.hasSecretId ??
            (current.auth.method === 'approle' ? current.auth.hasSecretId : false)
        }
      } else if (patch.auth.method === 'oidc') {
        auth = {
          method: 'oidc',
          role:
            'role' in patch.auth && typeof patch.auth.role === 'string'
              ? patch.auth.role
              : current.auth.method === 'oidc'
                ? current.auth.role
                : '',
          mountPath:
            'mountPath' in patch.auth && typeof patch.auth.mountPath === 'string'
              ? patch.auth.mountPath
              : current.auth.method === 'oidc'
                ? current.auth.mountPath
                : 'oidc',
          hasRefreshToken:
            patch.auth.hasRefreshToken ??
            (current.auth.method === 'oidc' ? current.auth.hasRefreshToken : false)
        }
      }
    }

    if (patch.token?.trim()) {
      await vaultSecureStorage.storeToken(patch.token.trim())
      auth = { method: 'token', hasToken: true }
    }
    if (patch.clearToken) {
      await vaultSecureStorage.deleteToken()
      if (auth.method === 'token') auth = { method: 'token', hasToken: false }
    }

    if (patch.secretId?.trim()) {
      await vaultSecureStorage.storeAppRoleSecretId(patch.secretId.trim())
      if (auth.method === 'approle') auth = { ...auth, hasSecretId: true }
    }
    if (patch.clearSecretId) {
      await vaultSecureStorage.deleteAppRoleSecretId()
      if (auth.method === 'approle') auth = { ...auth, hasSecretId: false }
    }

    if (patch.clearOidcRefresh) {
      await vaultSecureStorage.deleteOidcRefreshToken()
      if (auth.method === 'oidc') auth = { ...auth, hasRefreshToken: false }
    }

    const next: VaultSettings = {
      enabled: patch.enabled ?? current.enabled,
      address: patch.address ?? current.address,
      namespace: patch.namespace ?? current.namespace,
      defaultKvMount: patch.defaultKvMount ?? current.defaultKvMount,
      secretPathPrefix: patch.secretPathPrefix ?? current.secretPathPrefix,
      defaultBackend: patch.defaultBackend ?? current.defaultBackend,
      auth,
      tlsSkipVerify: patch.tlsSkipVerify ?? current.tlsSkipVerify
    }

    vaultAuthManager.invalidateCache()
    return this.writeSettings(next)
  }

  getDefaultBackend(): 'local' | 'vault' {
    const settings = this.getSettings()
    if (!settings.enabled) return 'local'
    return settings.defaultBackend
  }

  async getStatus(): Promise<VaultStatus> {
    const settings = this.getSettings()
    if (!settings.enabled || !settings.address.trim()) {
      return {
        configured: Boolean(settings.address.trim()),
        enabled: settings.enabled,
        authenticated: false,
        sealed: false,
        authMethod: null
      }
    }

    try {
      const health = await vaultHealthCheck({
        address: settings.address,
        namespace: settings.namespace,
        tlsSkipVerify: settings.tlsSkipVerify
      })
      const authenticated = health.initialized && !health.sealed
        ? await vaultAuthManager.isAuthenticated(settings)
        : false
      return {
        configured: true,
        enabled: settings.enabled,
        authenticated,
        sealed: health.sealed,
        authMethod: vaultAuthManager.currentAuthMethod(settings)
      }
    } catch (error) {
      return {
        configured: true,
        enabled: settings.enabled,
        authenticated: false,
        sealed: false,
        authMethod: vaultAuthManager.currentAuthMethod(settings),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async testConnection(): Promise<VaultStatus> {
    return this.getStatus()
  }
}

export const vaultSettingsRepository = new VaultSettingsRepository()
