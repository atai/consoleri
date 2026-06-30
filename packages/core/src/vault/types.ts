export type SecretBackendKind = 'local' | 'vault'

export type VaultAuthMethod = 'token' | 'approle' | 'oidc'

export interface VaultTokenAuthConfig {
  method: 'token'
  hasToken: boolean
}

export interface VaultAppRoleAuthConfig {
  method: 'approle'
  roleId: string
  mountPath: string
  hasSecretId: boolean
}

export interface VaultOidcAuthConfig {
  method: 'oidc'
  role: string
  mountPath: string
  hasRefreshToken: boolean
}

export type VaultAuthConfig = VaultTokenAuthConfig | VaultAppRoleAuthConfig | VaultOidcAuthConfig

export interface VaultSettings {
  enabled: boolean
  address: string
  namespace: string
  defaultKvMount: string
  secretPathPrefix: string
  defaultBackend: SecretBackendKind
  auth: VaultAuthConfig
  tlsSkipVerify: boolean
}

export interface VaultStatus {
  configured: boolean
  enabled: boolean
  authenticated: boolean
  sealed: boolean
  authMethod: VaultAuthMethod | null
  canWriteKv?: boolean
  error?: string
}

export interface VaultSettingsUpdate {
  enabled?: boolean
  address?: string
  namespace?: string
  defaultKvMount?: string
  secretPathPrefix?: string
  defaultBackend?: SecretBackendKind
  auth?: Partial<VaultAuthConfig> & { method?: VaultAuthMethod }
  tlsSkipVerify?: boolean
  token?: string
  secretId?: string
  clearToken?: boolean
  clearSecretId?: boolean
  clearOidcRefresh?: boolean
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  enabled: false,
  address: '',
  namespace: '',
  defaultKvMount: 'secret',
  secretPathPrefix: 'consoleri',
  defaultBackend: 'local',
  auth: { method: 'token', hasToken: false },
  tlsSkipVerify: false
}
