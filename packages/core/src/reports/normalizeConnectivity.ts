import type {
  ConnectivityTestConfig,
  ConnectivityTestHostResult,
  ConnectivityTestResult
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

function normalizeConnectivityHostResult(raw: unknown): ConnectivityTestHostResult | null {
  return normalizeHostResultBase(raw)
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
