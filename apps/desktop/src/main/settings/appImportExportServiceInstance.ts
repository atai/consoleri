import { AppImportExportService } from './AppImportExportService'
import { appPreferencesRepository } from '../preferences/AppPreferencesRepository'
import { vaultSettingsRepository } from '../vault/VaultSettingsRepository'
import { uxProfileRepository } from '../ux/UxProfileRepository'
import { hostImportExportService } from '../hosts/hostImportExportServiceInstance'
import { reportRepository } from '../reports/ReportRepository'
import { workspaceRepository } from '../hosts/WorkspaceRepository'
import { secretsRepository } from '../secrets/SecretsRepository'

export const appImportExportService = new AppImportExportService(
  appPreferencesRepository,
  vaultSettingsRepository,
  uxProfileRepository,
  hostImportExportService,
  reportRepository,
  workspaceRepository,
  secretsRepository
)
