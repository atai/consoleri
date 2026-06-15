export type ReportType = 'connectivity_test'

export type ConnectivityTestHostStatus = 'ok' | 'fail' | 'skipped'

export interface ConnectivityTestEntry {
  hostId: string
  profileId: string
}

export interface ConnectivityTestConfig {
  type: 'connectivity_test'
  entries: ConnectivityTestEntry[]
}

export type ReportConfig = ConnectivityTestConfig

export interface ConnectivityTestHostResult {
  hostId: string
  profileId: string
  status: ConnectivityTestHostStatus
  durationMs: number
  error?: string
  log?: string[]
}

export interface ConnectivityTestResult {
  runAt: string
  entries: ConnectivityTestHostResult[]
}

export interface Report {
  id: string
  name: string
  type: ReportType
  config: ReportConfig
  lastRunAt: string | null
  lastResult: ConnectivityTestResult | null
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
  status: ConnectivityTestHostStatus | 'running'
}

export interface ReportFormatLabels {
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}
