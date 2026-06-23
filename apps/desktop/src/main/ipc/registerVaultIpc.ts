import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { VaultSettingsUpdate } from '../../shared/types'
import { VaultSettingsUpdateSchema } from '../../shared/ipcSchemas'
import { createHandler } from './createHandler'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'
import { startVaultOidcLogin, logoutVaultOidc } from '../vault/VaultOidcLogin'

export function registerVaultIpc(): void {
  ipcMain.handle(IPC_CHANNELS.vaultGetSettings, () => {
    return vaultSettingsRepository.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.vaultUpdateSettings,
    createHandler(VaultSettingsUpdateSchema, (patch: VaultSettingsUpdate) =>
      Promise.resolve(vaultSettingsRepository.updateSettings(patch))
    )
  )

  ipcMain.handle(IPC_CHANNELS.vaultTestConnection, () => {
    return vaultSettingsRepository.testConnection()
  })

  ipcMain.handle(IPC_CHANNELS.vaultStatus, () => {
    return vaultSettingsRepository.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.vaultLogin, () => {
    return startVaultOidcLogin()
  })

  ipcMain.handle(IPC_CHANNELS.vaultLogout, () => {
    return logoutVaultOidc()
  })
}
