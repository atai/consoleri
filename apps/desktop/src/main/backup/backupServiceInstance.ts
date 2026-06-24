import { join } from 'path'
import { app } from 'electron'
import { BackupService } from './BackupService'
import { appImportExportService } from '../settings/appImportExportServiceInstance'

export const backupService = new BackupService(
  appImportExportService,
  join(app.getPath('userData'), 'backups')
)
