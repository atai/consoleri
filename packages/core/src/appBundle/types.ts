import type { AppSettings, Protocol } from '../types'
import type { HostListViewSettings } from '../hosts/hostListView'
import type { MapViewSettings } from '../map/mapView'
import type { VaultSettings } from '../vault/types'
import type { UxProfile } from '../ux/types'
import type { HostsExportDocument } from '../hosts/hostBundle/types'
import type { Report, ReportConfig, ReportResult } from '../reports/types'

export interface SessionConnectRequest {
  hostId?: string
  profileId?: string
  protocol?: Protocol
  title?: string
  localShell?: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl'
  wslDistro?: string
}

export const APP_BUNDLE_VERSION = 1
export const APP_BUNDLE_KIND = 'consoleri-app' as const

export interface AppSettingsExport {
  app: AppSettings
  hostListView: HostListViewSettings
  mapView: MapViewSettings
  vault: VaultSettings
  activeUxProfileId: string | null
  uxProfiles: UxProfile[]
}

export interface SecretExportItem {
  ref: string
  encryptedBlob: string
}

export interface ReportExportItem {
  exportId: string
  name: string
  type: Report['type']
  config: ReportConfig
  lastRunAt: string | null
  lastResult: ReportResult | null
  createdAt: string
  updatedAt: string
}

export interface PaneBindingExport {
  paneId: string
  connectRequest: SessionConnectRequest
}

export interface WorkspaceExportItem {
  name: string
  layout: unknown
  panes: PaneBindingExport[]
}

export interface AppExportDocument {
  kind: typeof APP_BUNDLE_KIND
  version: typeof APP_BUNDLE_VERSION
  exportedAt: string
  settings: AppSettingsExport
  secrets: SecretExportItem[]
  hosts: HostsExportDocument
  reports: ReportExportItem[]
  workspace: WorkspaceExportItem | null
}
