import type { ReportConfig, ReportResult, ReportType } from './types'
import { normalizeConnectivityTestConfig, normalizeConnectivityTestResult } from './normalizeConnectivity'
import { normalizeInventoryConfig, normalizeInventoryResult } from './normalizeInventory'

export { normalizeConnectivityTestConfig, normalizeConnectivityTestResult } from './normalizeConnectivity'
export { normalizeInventoryConfig, normalizeInventoryResult } from './normalizeInventory'
export { isNonEmptyString, normalizeHostEntry, normalizeHostEntries } from './normalizeCommon'

export function normalizeReportConfig(type: ReportType, input: unknown): ReportConfig {
  switch (type) {
    case 'connectivity_test':
      return normalizeConnectivityTestConfig(input)
    case 'inventory':
      return normalizeInventoryConfig(input)
    default:
      return normalizeConnectivityTestConfig(input)
  }
}

export function normalizeReportResult(type: ReportType, input: unknown): ReportResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Partial<ReportResult>
  const resultType = raw.type ?? type

  switch (resultType) {
    case 'connectivity_test':
      return normalizeConnectivityTestResult(input)
    case 'inventory':
      return normalizeInventoryResult(input)
    default:
      return normalizeConnectivityTestResult(input)
  }
}
