import type { Report, ReportFormatLabels, ReportResult } from './types'
import {
  formatConnectivityReportMarkdown,
  formatConnectivityReportText,
  summarizeConnectivityResult
} from './formatConnectivity'
import {
  formatInventoryReportMarkdown,
  formatInventoryReportText,
  summarizeInventoryResult
} from './formatInventory'

export { formatDuration, formatBytes, statusLabel, formatRunTimestamp, totalReportDurationMs } from './formatCommon'
export {
  formatConnectivityReportMarkdown,
  formatConnectivityReportText,
  summarizeConnectivityResult
} from './formatConnectivity'
export {
  formatInventoryReportMarkdown,
  formatInventoryReportText,
  summarizeInventoryResult
} from './formatInventory'

export function formatReportMarkdown(
  report: Report,
  result: ReportResult,
  labels: ReportFormatLabels
): string {
  switch (result.type) {
    case 'connectivity_test':
      return formatConnectivityReportMarkdown(report, result, labels)
    case 'inventory':
      return formatInventoryReportMarkdown(report, result, labels)
    default:
      return formatConnectivityReportMarkdown(report, result as never, labels)
  }
}

export function formatReportText(
  report: Report,
  result: ReportResult,
  labels: ReportFormatLabels
): string {
  switch (result.type) {
    case 'connectivity_test':
      return formatConnectivityReportText(report, result, labels)
    case 'inventory':
      return formatInventoryReportText(report, result, labels)
    default:
      return formatConnectivityReportText(report, result as never, labels)
  }
}

export function summarizeReportResult(result: ReportResult): string {
  switch (result.type) {
    case 'connectivity_test':
      return summarizeConnectivityResult(result)
    case 'inventory':
      return summarizeInventoryResult(result)
    default:
      return ''
  }
}
