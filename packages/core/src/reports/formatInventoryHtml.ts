import type { InventoryResult, Report, ReportFormatLabels } from './types'
import {
  formatBytes,
  formatDuration,
  formatRunTimestamp,
  joinList,
  statusLabel
} from './formatCommon'
import { escapeHtml, htmlPreBlock, htmlSection, statusCssClass, wrapReportHtml } from './formatHtmlCommon'

function buildErrorSections(result: InventoryResult, labels: ReportFormatLabels): string {
  const failures = result.entries.filter(
    (e) => e.status === 'fail' || e.error || (e.log && e.log.length > 0)
  )
  if (failures.length === 0) return ''

  const sections = failures.map((entry) => {
    const host = labels.hostName(entry.hostId)
    const parts: string[] = []
    if (entry.error) {
      parts.push(htmlPreBlock(entry.error))
    }
    if (entry.log && entry.log.length > 0) {
      parts.push(htmlPreBlock(entry.log.join('\n')))
    }
    return htmlSection(host, parts.join(''))
  })

  return `<h2>Errors &amp; details</h2>${sections.join('')}`
}

export function formatInventoryReportHtml(
  report: Report,
  result: InventoryResult,
  labels: ReportFormatLabels
): string {
  const rows = result.entries
    .map((entry) => {
      const inv = entry.inventory
      const statusClass = statusCssClass(entry.status)
      return `<tr>
        <td class="host">${escapeHtml(labels.hostName(entry.hostId))}</td>
        <td class="muted">${escapeHtml(labels.profileName(entry.profileId))}</td>
        <td>${escapeHtml(inv?.os ?? '—')}</td>
        <td class="muted">${escapeHtml(inv ? formatBytes(inv.ramBytes) : '—')}</td>
        <td class="muted">${escapeHtml(inv?.cpu ?? '—')}</td>
        <td class="muted">${escapeHtml(joinList(inv?.hostnames ?? []))}</td>
        <td class="muted">${escapeHtml(joinList(inv?.ipv4 ?? []))}</td>
        <td class="muted">${escapeHtml(joinList(inv?.ipv6 ?? []))}</td>
        <td class="${statusClass}">${escapeHtml(statusLabel(entry.status))}</td>
        <td class="muted">${escapeHtml(formatDuration(entry.durationMs))}</td>
      </tr>`
    })
    .join('')

  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length

  const body = `<table>
    <thead>
      <tr>
        <th>Host</th><th>Profile</th><th>OS</th><th>RAM</th><th>CPU</th>
        <th>Hostnames</th><th>IPv4</th><th>IPv6</th><th>Status</th><th>Duration</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${buildErrorSections(result, labels)}
  <p class="summary">Summary: ${ok} collected, ${fail} failed${skipped > 0 ? `, ${skipped} skipped` : ''}</p>`

  const meta = `Type: Inventory · Run at: ${escapeHtml(formatRunTimestamp(result.runAt))}`

  return wrapReportHtml(report.name, meta, body)
}
