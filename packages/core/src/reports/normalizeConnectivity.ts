import type {
  ConnectivityTestConfig,
  ConnectivityTestHostResult,
  ConnectivityTestResult,
  ReportHostStatus
} from './types'
import {
  isNonEmptyString,
  normalizeHostEntries,
  normalizeHostResultBase
} from './normalizeCommon'

export function normalizeConnectivityTestConfig(input: unknown): ConnectivityTestConfig {
  if (typeof input !== 'object' || input === null) {
    return { type: 'connectivity_test', entries: [] }
  }
  const raw = input as Partial<ConnectivityTestConfig>
  return {
    type: 'connectivity_test',
    entries: normalizeHostEntries(raw.entries)
  }
}

function normalizePingStatus(value: unknown): ReportHostStatus | undefined {
  if (value === 'ok' || value === 'fail') return value
  return undefined
}

function normalizeConnectivityHostResult(raw: unknown): ConnectivityTestHostResult | null {
  const base = normalizeHostResultBase(raw)
  if (!base) return null

  const entry = raw as Partial<ConnectivityTestHostResult>
  const result: ConnectivityTestHostResult = { ...base }

  const pingStatus = normalizePingStatus(entry.pingStatus)
  if (pingStatus) result.pingStatus = pingStatus

  if (typeof entry.pingDurationMs === 'number' && entry.pingDurationMs >= 0) {
    result.pingDurationMs = entry.pingDurationMs
  }

  if (isNonEmptyString(entry.pingError)) result.pingError = entry.pingError

  return result
}

export function normalizeConnectivityTestResult(input: unknown): ConnectivityTestResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Partial<ConnectivityTestResult>
  if (!isNonEmptyString(raw.runAt)) return null
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map(normalizeConnectivityHostResult)
        .filter((e): e is ConnectivityTestHostResult => e !== null)
    : []
  return { type: 'connectivity_test', runAt: raw.runAt, entries }
}
