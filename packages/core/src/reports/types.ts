export type ReportType = 'connectivity_test' | 'inventory'

export type ReportHostStatus = 'ok' | 'fail' | 'skipped'

/** @deprecated Use ReportHostStatus */
export type ConnectivityTestHostStatus = ReportHostStatus

export interface ReportHostEntry {
  hostId: string
  profileId: string
}

export type ConnectivityTestEntry = ReportHostEntry
export type InventoryEntry = ReportHostEntry

export interface ReportHostResultBase {
  hostId: string
  profileId: string
  status: ReportHostStatus
  durationMs: number
  error?: string
  log?: string[]
}

export interface ConnectivityTestConfig {
  type: 'connectivity_test'
  entries: ConnectivityTestEntry[]
}

export interface InventoryConfig {
  type: 'inventory'
  entries: InventoryEntry[]
}

export type ReportConfig = ConnectivityTestConfig | InventoryConfig

export interface ConnectivityTestHostResult extends ReportHostResultBase {}

export interface ConnectivityTestResult {
  type: 'connectivity_test'
  runAt: string
  entries: ConnectivityTestHostResult[]
}

export interface InventoryHostData {
  os: string
  ramBytes: number
  cpu: string
  hostnames: string[]
  ipv4: string[]
  ipv6: string[]
}

export interface InventoryHostResult extends ReportHostResultBase {
  inventory?: InventoryHostData
}

export interface InventoryResult {
  type: 'inventory'
  runAt: string
  entries: InventoryHostResult[]
}

export type ReportResult = ConnectivityTestResult | InventoryResult

export interface Report {
  id: string
  name: string
  type: ReportType
  config: ReportConfig
  lastRunAt: string | null
  lastResult: ReportResult | null
  createdAt: string
  updatedAt: string
}

export interface ReportInput {
  name: string
  type: ReportType
  config: ReportConfig
}

export interface ReportProgressEvent {
  reportId: string
  index: number
  total: number
  hostId: string
  status: ReportHostStatus | 'running'
}

export interface ReportFormatLabels {
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}
