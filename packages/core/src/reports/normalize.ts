import type {
  ConnectivityTestConfig,
  ConnectivityTestEntry,
  ConnectivityTestHostResult,
  ConnectivityTestResult,
  ReportConfig,
  ReportType
} from './types'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeEntry(raw: unknown): ConnectivityTestEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<ConnectivityTestEntry>
  if (!isNonEmptyString(entry.hostId) || !isNonEmptyString(entry.profileId)) return null
  return { hostId: entry.hostId, profileId: entry.profileId }
}

export function normalizeConnectivityTestConfig(input: unknown): ConnectivityTestConfig {
  if (typeof input !== 'object' || input === null) {
    return { type: 'connectivity_test', entries: [] }
  }
  const raw = input as Partial<ConnectivityTestConfig>
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(normalizeEntry).filter((e): e is ConnectivityTestEntry => e !== null)
    : []
  return { type: 'connectivity_test', entries }
}

export function normalizeReportConfig(type: ReportType, input: unknown): ReportConfig {
  if (type === 'connectivity_test') {
    return normalizeConnectivityTestConfig(input)
  }
  return { type: 'connectivity_test', entries: [] }
}

function normalizeHostResult(raw: unknown): ConnectivityTestHostResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<ConnectivityTestHostResult>
  if (!isNonEmptyString(entry.hostId) || !isNonEmptyString(entry.profileId)) return null
  const status =
    entry.status === 'ok' || entry.status === 'fail' || entry.status === 'skipped'
      ? entry.status
      : 'fail'
  const durationMs = typeof entry.durationMs === 'number' && entry.durationMs >= 0 ? entry.durationMs : 0
  const result: ConnectivityTestHostResult = {
    hostId: entry.hostId,
    profileId: entry.profileId,
    status,
    durationMs
  }
  if (isNonEmptyString(entry.error)) result.error = entry.error
  if (Array.isArray(entry.log)) {
    result.log = entry.log.filter((line): line is string => typeof line === 'string')
  }
  return result
}

export function normalizeConnectivityTestResult(input: unknown): ConnectivityTestResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Partial<ConnectivityTestResult>
  if (!isNonEmptyString(raw.runAt)) return null
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(normalizeHostResult).filter((e): e is ConnectivityTestHostResult => e !== null)
    : []
  return { runAt: raw.runAt, entries }
}
