import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { appImportExportService } from '../settings/appImportExportServiceInstance'
import { backupService } from '../backup/backupServiceInstance'

export function registerAppIpc(): void {
  ipcMain.handle(IPC_CHANNELS.appExport, () => appImportExportService.exportAppBundle())

  ipcMain.handle(IPC_CHANNELS.appExportToFile, () =>
    appImportExportService.exportAppToFile()
  )

  ipcMain.handle(IPC_CHANNELS.appImportFromFile, () =>
    appImportExportService.importAppFromFile()
  )

  ipcMain.handle(IPC_CHANNELS.backupGetSettings, () => backupService.getSettings())

  ipcMain.handle(IPC_CHANNELS.backupUpdateSettings, (_e, patch: unknown) =>
    backupService.updateSettings(patch)
  )

  ipcMain.handle(IPC_CHANNELS.backupList, () => backupService.listBackups())

  ipcMain.handle(IPC_CHANNELS.backupCreateNow, () => backupService.createBackupNow())

  ipcMain.handle(IPC_CHANNELS.backupRestore, (_e, id: string) =>
    backupService.restoreBackup(id)
  )

  ipcMain.handle(IPC_CHANNELS.backupDelete, (_e, id: string) =>
    backupService.deleteBackup(id)
  )

  ipcMain.handle(IPC_CHANNELS.backupOpenFolder, () => backupService.openBackupFolder())
}
