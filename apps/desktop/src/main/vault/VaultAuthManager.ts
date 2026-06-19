import type { VaultAuthMethod, VaultSettings } from '@consoleri/core'
import { vaultRequest } from './vaultClient'
import { vaultSecureStorage } from './VaultSecureStorage'

interface CachedToken {
  token: string
  expiresAt: number
}

export class VaultAuthManager {
  private cachedToken: CachedToken | null = null

  invalidateCache(): void {
    this.cachedToken = null
  }

  async getToken(settings: VaultSettings): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token
    }

    const token = await this.resolveToken(settings)
    this.cachedToken = {
      token,
      expiresAt: Date.now() + 4 * 60 * 1000
    }
    return token
  }

  async isAuthenticated(settings: VaultSettings): Promise<boolean> {
    try {
      await this.getToken(settings)
      return true
    } catch {
      return false
    }
  }

  private async resolveToken(settings: VaultSettings): Promise<string> {
    switch (settings.auth.method) {
      case 'token':
        return this.resolveTokenAuth()
      case 'approle':
        return this.resolveAppRoleAuth(settings)
      case 'oidc':
        return this.resolveOidcAuth(settings)
      default:
        throw new Error('Unsupported Vault auth method')
    }
  }

  private async resolveTokenAuth(): Promise<string> {
    const token = await vaultSecureStorage.getToken()
    if (!token) throw new Error('Vault token is not configured')
    return token
  }

  private async resolveAppRoleAuth(settings: VaultSettings): Promise<string> {
    if (settings.auth.method !== 'approle') {
      throw new Error('Vault AppRole auth is not configured')
    }
    const secretId = await vaultSecureStorage.getAppRoleSecretId()
    if (!secretId) throw new Error('Vault AppRole secret_id is not configured')

    const mount = settings.auth.mountPath.replace(/^\/+|\/+$/g, '') || 'approle'
    const response = await vaultRequest({
      address: settings.address,
      path: `auth/${mount}/login`,
      method: 'POST',
      namespace: settings.namespace,
      tlsSkipVerify: settings.tlsSkipVerify,
      body: {
        role_id: settings.auth.roleId,
        secret_id: secretId
      }
    })

    const token = response.auth?.client_token
    if (!token) throw new Error('Vault AppRole login did not return a token')
    return token
  }

  private async resolveOidcAuth(settings: VaultSettings): Promise<string> {
    if (settings.auth.method !== 'oidc') {
      throw new Error('Vault OIDC auth is not configured')
    }

    const refreshToken = await vaultSecureStorage.getOidcRefreshToken()
    if (!refreshToken) {
      throw new Error('Vault OIDC session expired. Sign in again.')
    }

    const mount = settings.auth.mountPath.replace(/^\/+|\/+$/g, '') || 'oidc'
    const response = await vaultRequest({
      address: settings.address,
      path: `auth/${mount}/oidc/token`,
      method: 'POST',
      namespace: settings.namespace,
      tlsSkipVerify: settings.tlsSkipVerify,
      body: { role: settings.auth.role, refresh_token: refreshToken }
    })

    const token = response.auth?.client_token
    if (!token) throw new Error('Vault OIDC refresh did not return a token')

    const nextRefresh = (response.auth as { refresh_token?: string } | undefined)?.refresh_token
    if (nextRefresh) {
      await vaultSecureStorage.storeOidcRefreshToken(nextRefresh)
    }

    return token
  }

  currentAuthMethod(settings: VaultSettings): VaultAuthMethod | null {
    return settings.enabled ? settings.auth.method : null
  }
}

export const vaultAuthManager = new VaultAuthManager()
