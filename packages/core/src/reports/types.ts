export type ReportType = 'connectivity_test' | 'inventory' | 'custom_test'

export type ReportHostStatus = 'ok' | 'fail' | 'skipped'

/** @deprecated Use ReportHostStatus */
export type ConnectivityTestHostStatus = ReportHostStatus

export interface ReportHostEntry {
  hostId: string
  profileId: string
}

export type ConnectivityTestEntry = ReportHostEntry
export type InventoryEntry = ReportHostEntry
export type CustomTestEntry = ReportHostEntry

export interface CustomTestCommand {
  command: string
}

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

export interface CustomTestConfig {
  type: 'custom_test'
  entries: CustomTestEntry[]
  commands: CustomTestCommand[]
  continueOnError: boolean
}

export type ReportConfig = ConnectivityTestConfig | InventoryConfig | CustomTestConfig

export interface ConnectivityTestHostResult extends ReportHostResultBase {
  pingStatus?: ReportHostStatus
  pingDurationMs?: number
  pingError?: string
  httpStatusCode?: number
  httpDurationMs?: number
  httpError?: string
}

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

export interface CustomTestCommandResult {
  index: number
  command: string
  status: ReportHostStatus
  code: number | null
  stdout: string
  stderr: string
  durationMs: number
  error?: string
}

export interface CustomTestHostResult extends ReportHostResultBase {
  commands: CustomTestCommandResult[]
}

export interface CustomTestResult {
  type: 'custom_test'
  runAt: string
  entries: CustomTestHostResult[]
}

export type ReportResult = ConnectivityTestResult | InventoryResult | CustomTestResult

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
  commandIndex?: number
  commandTotal?: number
}

export interface ReportFormatLabels {
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}
