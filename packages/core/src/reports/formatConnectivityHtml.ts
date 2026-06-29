import type { ConnectivityTestResult, Report, ReportFormatLabels } from './types'
import { formatDuration, formatRunTimestamp, statusLabel } from './formatCommon'
import {
  classifyHttpStatus,
  connectivityResultHasHttpColumn,
  formatHttpStatusLabel
} from './httpStatusColor'
import {
  escapeHtml,
  htmlPreBlock,
  htmlSection,
  httpStatusCssClass,
  statusCssClass,
  wrapReportHtml
} from './formatHtmlCommon'

function formatPingLabel(pingStatus: string | undefined): string {
  if (!pingStatus) return '—'
  return statusLabel(pingStatus)
}

function buildErrorSections(
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const failures = result.entries.filter(
    (e) =>
      e.status === 'fail' ||
      e.pingStatus === 'fail' ||
      e.error ||
      e.pingError ||
      e.httpError ||
      (e.log && e.log.length > 0)
  )
  if (failures.length === 0) return ''

  const sections = failures.map((entry) => {
    const host = labels.hostName(entry.hostId)
    const parts: string[] = []
    if (entry.pingError) {
      parts.push(`<p><strong>Ping</strong></p>${htmlPreBlock(entry.pingError)}`)
    }
    if (entry.httpError) {
      parts.push(`<p><strong>HTTP</strong></p>${htmlPreBlock(entry.httpError)}`)
    }
    if (entry.error) {
      parts.push(`<p><strong>SSH</strong></p>${htmlPreBlock(entry.error)}`)
    }
    if (entry.log && entry.log.length > 0) {
      parts.push(htmlPreBlock(entry.log.join('\n')))
    }
    return htmlSection(host, parts.join(''))
  })

  return `<h2>Errors &amp; details</h2>${sections.join('')}`
}

export function formatConnectivityReportHtml(
  report: Report,
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const showHttp = connectivityResultHasHttpColumn(result.entries)
  const headerCells = showHttp
    ? '<th>Host</th><th>Profile</th><th>Ping</th><th>SSH</th><th>HTTP</th><th>Duration</th>'
    : '<th>Host</th><th>Profile</th><th>Ping</th><th>SSH</th><th>Duration</th>'

  const rows = result.entries
    .map((entry) => {
      const host = escapeHtml(labels.hostName(entry.hostId))
      const profile = escapeHtml(labels.profileName(entry.profileId))
      const pingClass = entry.pingStatus ? statusCssClass(entry.pingStatus) : 'status-muted'
      const sshClass = statusCssClass(entry.status)
      const httpTone = classifyHttpStatus(entry.httpStatusCode, entry.httpError)
      const httpClass = httpStatusCssClass(httpTone)
      const httpLabel = escapeHtml(formatHttpStatusLabel(entry.httpStatusCode, entry.httpError))
      const httpCell = showHttp
        ? `<td class="${httpClass}">${httpLabel}</td>`
        : ''
      return `<tr>
        <td class="host">${host}</td>
        <td class="muted">${profile}</td>
        <td class="${pingClass}">${escapeHtml(formatPingLabel(entry.pingStatus))}</td>
        <td class="${sshClass}">${escapeHtml(statusLabel(entry.status))}</td>
        ${httpCell}
        <td class="muted">${escapeHtml(formatDuration(entry.durationMs))}</td>
      </tr>`
    })
    .join('')

  const pingOk = result.entries.filter((e) => e.pingStatus === 'ok').length
  const pingFail = result.entries.filter((e) => e.pingStatus === 'fail').length
  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length

  const body = `<table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${buildErrorSections(result, labels)}
  <p class="summary">Summary: ping ${pingOk} ok, ${pingFail} fail | ssh ${ok} ok, ${fail} fail, ${skipped} skipped</p>`

  const meta = `Type: Connectivity test · Run at: ${escapeHtml(formatRunTimestamp(result.runAt))}`

  return wrapReportHtml(report.name, meta, body)
}
