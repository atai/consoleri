import { dialog } from 'electron'
import { writeFileSync, readFileSync } from 'fs'
import {
  buildAppExportDocument,
  buildAppSettingsExport,
  isAppExportDocument,
  normalizeAppExportDocument,
  parseAppImportJson,
  serializeAppExportDocument,
  type AppExportDocument
} from '@consoleri/core'
import { getDatabase } from '../db/database'
import type { AppPreferencesRepository } from '../preferences/AppPreferencesRepository'
import type { VaultSettingsRepository } from '../vault/VaultSettingsRepository'
import type { UxProfileRepository } from '../ux/UxProfileRepository'
import type { HostImportExportService } from '../hosts/HostImportExportService'
import type { ReportRepository } from '../reports/ReportRepository'
import type { WorkspaceRepository } from '../hosts/WorkspaceRepository'
import type { SecretsRepository } from '../secrets/SecretsRepository'

export class AppImportExportService {
  constructor(
    private readonly prefsRepo: AppPreferencesRepository,
    private readonly vaultRepo: VaultSettingsRepository,
    private readonly uxRepo: UxProfileRepository,
    private readonly hostIE: HostImportExportService,
    private readonly reportRepo: ReportRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly secretsRepo: SecretsRepository
  ) {}

  exportAppBundle(): AppExportDocument {
    const app = this.prefsRepo.getAppSettings()
    const hostListView = this.prefsRepo.getHostListView()
    const mapView = this.prefsRepo.getMapView()
    const vault = this.vaultRepo.getSettings()
    const activeUxProfileId = this.uxRepo.getActiveId()
    const uxProfiles = this.uxRepo.list()
    const secrets = this.secretsRepo.listAllEncrypted()

    const settings = buildAppSettingsExport(
      app,
      hostListView,
      mapView,
      vault,
      activeUxProfileId,
      uxProfiles
    )

    const hostsDoc = this.hostIE.exportHostsBundle()
    const reports = this.reportRepo.list()

    const activeWorkspace = this.workspaceRepo.getActiveWorkspace()
    const workspaceState = this.workspaceRepo.loadWorkspace()
    const workspace = {
      name: activeWorkspace.name,
      layout: workspaceState.layout,
      panes: workspaceState.panes.map((p) => ({
        paneId: p.paneId,
        connectRequest: p.connectRequest as Record<string, unknown>
      }))
    }

    return buildAppExportDocument(settings, secrets, hostsDoc, reports, workspace)
  }

  async exportAppToFile(): Promise<{ path: string } | { canceled: true }> {
    const doc = this.exportAppBundle()
    const date = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: 'Export full settings JSON',
      defaultPath: `consoleri-app-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    writeFileSync(result.filePath, serializeAppExportDocument(doc), 'utf8')
    return { path: result.filePath }
  }

  async importAppFromFile(): Promise<void> {
    const result = await dialog.showOpenDialog({
      title: 'Import full settings JSON',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return
    const json = readFileSync(result.filePaths[0], 'utf8')
    const doc = parseAppImportJson(json)
    this.importAppBundleReplace(doc)
  }

  /**
   * Parses the payload and determines which format it is.
   * Returns the parsed AppExportDocument if it is a full bundle,
   * or null if it is a hosts-only document (handled separately).
   */
  parseAppPayload(payload: unknown): AppExportDocument | null {
    if (isAppExportDocument(payload)) {
      return normalizeAppExportDocument(payload)
    }
    return null
  }

  importAppBundleReplace(doc: AppExportDocument): void {
    const db = getDatabase()

    db.exec('BEGIN')
    try {
      // 1. Secrets
      this.secretsRepo.replaceAll(doc.secrets)

      // 2. Vault settings (non-secret part)
      // We write the JSON directly to app_preferences rather than going through
      // VaultSettingsRepository.updateSettings which also touches safeStorage.
      db.prepare(
        `INSERT INTO app_preferences (key, value) VALUES ('vault_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(JSON.stringify(doc.settings.vault))

      // 3. UX profiles — replace custom (non-builtin) profiles then restore
      db.prepare('DELETE FROM ux_profiles WHERE is_builtin = 0').run()
      const now = new Date().toISOString()
      for (const profile of doc.settings.uxProfiles) {
        if (profile.isBuiltin) continue
        db.prepare(
          `INSERT OR REPLACE INTO ux_profiles (id, name, settings_json, is_builtin, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, ?)`
        ).run(
          profile.id,
          profile.name,
          JSON.stringify({ terminal: profile.terminal, chrome: profile.chrome }),
          profile.createdAt ?? now,
          profile.updatedAt ?? now
        )
      }

      // 4. App preferences
      const activeId = doc.settings.activeUxProfileId ?? 'builtin-github-dark'
      db.prepare(
        `INSERT INTO app_preferences (key, value) VALUES ('active_ux_profile_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(activeId)
      db.prepare(
        `INSERT INTO app_preferences (key, value) VALUES ('app_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(JSON.stringify(doc.settings.app))
      db.prepare(
        `INSERT INTO app_preferences (key, value) VALUES ('host_list_view', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(JSON.stringify(doc.settings.hostListView))
      db.prepare(
        `INSERT INTO app_preferences (key, value) VALUES ('map_view', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(JSON.stringify(doc.settings.mapView))

      // 5. Hosts — full replace preserving IDs
      this.hostIE.importHostsBundleReplace(doc.hosts)

      // 6. Reports — full replace
      db.prepare('DELETE FROM reports').run()
      for (const report of doc.reports) {
        db.prepare(
          `INSERT INTO reports (id, name, type, config_json, last_run_at, last_result_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          report.exportId,
          report.name,
          report.type,
          JSON.stringify(report.config),
          report.lastRunAt ?? null,
          report.lastResult ? JSON.stringify(report.lastResult) : null,
          report.createdAt,
          report.updatedAt
        )
      }

      // 7. Workspace — replace active workspace layout
      if (doc.workspace) {
        const ws = this.workspaceRepo.getActiveWorkspace()
        const panes = doc.workspace.panes.map((p) => ({
          paneId: p.paneId,
          sessionId: null,
          protocol: (p.connectRequest.protocol as string) ?? 'ssh',
          title: (p.connectRequest.title as string) ?? '',
          connectRequest: p.connectRequest
        }))
        const layoutJson = JSON.stringify({
          layout: doc.workspace.layout,
          panes
        })
        db.prepare(
          'UPDATE workspaces SET name=?, layout_json=? WHERE id=?'
        ).run(doc.workspace.name, layoutJson, ws.id)
        db.prepare('DELETE FROM workspace_panes WHERE workspace_id = ?').run(ws.id)
      }

      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
