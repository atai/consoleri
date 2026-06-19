import { isVaultRef, parseVaultRef } from '@consoleri/core'
import type { SecretBackend } from './SecretBackend'
import { vaultAuthManager } from '../vault/VaultAuthManager'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'
import { vaultRequest } from '../vault/vaultClient'

export class HashicorpVaultBackend implements SecretBackend {
  readonly id = 'vault' as const

  canHandle(ref: string): boolean {
    return isVaultRef(ref)
  }

  async store(ref: string, secret: string): Promise<void> {
    const settings = this.requireEnabledSettings()
    const { mount, logicalPath, field } = parseVaultRef(ref)
    const token = await vaultAuthManager.getToken(settings)

    let existing: Record<string, string> = {}
    try {
      const current = await vaultRequest({
        address: settings.address,
        path: `${mount}/data/${logicalPath}`,
        method: 'GET',
        token,
        namespace: settings.namespace,
        tlsSkipVerify: settings.tlsSkipVerify
      })
      const data = current.data?.data
      if (data && typeof data === 'object') {
        existing = Object.fromEntries(
          Object.entries(data as Record<string, unknown>).map(([key, value]) => [
            key,
            String(value)
          ])
        )
      }
    } catch {
      /* new secret path */
    }

    await vaultRequest({
      address: settings.address,
      path: `${mount}/data/${logicalPath}`,
      method: 'POST',
      token,
      namespace: settings.namespace,
      tlsSkipVerify: settings.tlsSkipVerify,
      body: { data: { ...existing, [field]: secret } }
    })
  }

  async retrieve(ref: string): Promise<string | null> {
    const settings = this.requireEnabledSettings()
    const { mount, logicalPath, field } = parseVaultRef(ref)
    const token = await vaultAuthManager.getToken(settings)

    try {
      const response = await vaultRequest({
        address: settings.address,
        path: `${mount}/data/${logicalPath}`,
        method: 'GET',
        token,
        namespace: settings.namespace,
        tlsSkipVerify: settings.tlsSkipVerify
      })
      const data = response.data?.data as Record<string, unknown> | undefined
      const value = data?.[field]
      return value === undefined || value === null ? null : String(value)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('not found')) return null
      throw error
    }
  }

  async delete(ref: string): Promise<void> {
    const settings = this.requireEnabledSettings()
    const { mount, logicalPath } = parseVaultRef(ref)
    const token = await vaultAuthManager.getToken(settings)

    await vaultRequest({
      address: settings.address,
      path: `${mount}/metadata/${logicalPath}`,
      method: 'DELETE',
      token,
      namespace: settings.namespace,
      tlsSkipVerify: settings.tlsSkipVerify
    })
  }

  private requireEnabledSettings() {
    const settings = vaultSettingsRepository.getSettings()
    if (!settings.enabled) {
      throw new Error('HashiCorp Vault backend is not enabled')
    }
    if (!settings.address.trim()) {
      throw new Error('Vault address is not configured')
    }
    return settings
  }
}

export const hashicorpVaultBackend = new HashicorpVaultBackend()
