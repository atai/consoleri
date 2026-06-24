import type { AppSettings } from '../types'
import type { HostListViewSettings } from '../hosts/hostListView'
import type { MapViewSettings } from '../map/mapView'
import type { VaultSettings } from '../vault/types'
import type { UxProfile } from '../ux/types'
import type { HostsExportDocument } from '../hosts/hostBundle/types'
import type { Report } from '../reports/types'
import type {
  AppExportDocument,
  AppSettingsExport,
  ReportExportItem,
  SecretExportItem,
  WorkspaceExportItem,
  PaneBindingExport
} from './types'
import { APP_BUNDLE_KIND, APP_BUNDLE_VERSION } from './types'

export function buildAppSettingsExport(
  app: AppSettings,
  hostListView: HostListViewSettings,
  mapView: MapViewSettings,
  vault: VaultSettings,
  activeUxProfileId: string | null,
  uxProfiles: UxProfile[]
): AppSettingsExport {
  return { app, hostListView, mapView, vault, activeUxProfileId, uxProfiles }
}

export function reportToExportItem(report: Report): ReportExportItem {
  return {
    exportId: report.id,
    name: report.name,
    type: report.type,
    config: report.config,
    lastRunAt: report.lastRunAt,
    lastResult: report.lastResult,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  }
}

export interface WorkspaceForExport {
  name: string
  layout: unknown
  panes: Array<{
    paneId: string
    connectRequest: PaneBindingExport['connectRequest']
  }>
}

export function buildWorkspaceExportItem(workspace: WorkspaceForExport): WorkspaceExportItem {
  const panes: PaneBindingExport[] = workspace.panes.map((p) => ({
    paneId: p.paneId,
    connectRequest: { ...p.connectRequest }
  }))
  return { name: workspace.name, layout: workspace.layout, panes }
}

export function buildAppExportDocument(
  settings: AppSettingsExport,
  secrets: SecretExportItem[],
  hosts: HostsExportDocument,
  reports: Report[],
  workspace: WorkspaceForExport | null,
  exportedAt: string = new Date().toISOString()
): AppExportDocument {
  return {
    kind: APP_BUNDLE_KIND,
    version: APP_BUNDLE_VERSION,
    exportedAt,
    settings,
    secrets,
    hosts,
    reports: reports.map(reportToExportItem),
    workspace: workspace ? buildWorkspaceExportItem(workspace) : null
  }
}

export function serializeAppExportDocument(doc: AppExportDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}
