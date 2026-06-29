import type { CustomTestResult, Report, ReportFormatLabels } from './types'
import { formatDuration, formatRunTimestamp, statusLabel } from './formatCommon'
import { escapeHtml, htmlPreBlock, htmlSection, statusCssClass, wrapReportHtml } from './formatHtmlCommon'

function commandSummary(entry: CustomTestResult['entries'][number]): string {
  const total = entry.commands.length
  if (total === 0) return '—'
  const ok = entry.commands.filter((c) => c.status === 'ok').length
  const skipped = entry.commands.filter((c) => c.status === 'skipped').length
  if (skipped > 0) {
    return `${ok}/${total} ok (${skipped} skipped)`
  }
  return `${ok}/${total} ok`
}

function formatCommandOutput(stdout: string, stderr: string): string {
  const parts: string[] = []
  if (stdout.trim()) parts.push(stdout.trim())
  if (stderr.trim()) parts.push(`stderr: ${stderr.trim()}`)
  return parts.length > 0 ? parts.join('\n') : '—'
}

function buildCommandDetails(result: CustomTestResult, labels: ReportFormatLabels): string {
  const withCommands = result.entries.filter((e) => e.commands.length > 0)
  if (withCommands.length === 0) return ''

  const sections = withCommands.map((entry) => {
    const host = labels.hostName(entry.hostId)
    const rows = entry.commands
      .map((cmd) => {
        const exitCode = cmd.code !== null ? String(cmd.code) : '—'
        const output = formatCommandOutput(cmd.stdout, cmd.stderr)
        const outputCell =
          output === '—' ? '—' : htmlPreBlock(output)
        return `<tr>
          <td>${cmd.index + 1}</td>
          <td><code>${escapeHtml(cmd.command)}</code></td>
          <td class="muted">${escapeHtml(exitCode)}</td>
          <td class="${statusCssClass(cmd.status)}">${escapeHtml(statusLabel(cmd.status))}</td>
          <td class="muted">${escapeHtml(formatDuration(cmd.durationMs))}</td>
          <td>${outputCell}</td>
        </tr>`
      })
      .join('')

    const table = `<table>
      <thead>
        <tr>
          <th>#</th><th>Command</th><th>Exit</th><th>Status</th><th>Duration</th><th>Output</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`

    return htmlSection(host, table)
  })

  return `<h2>Command details</h2>${sections.join('')}`
}

function buildErrorSections(result: CustomTestResult, labels: ReportFormatLabels): string {
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

  return `<h2>Errors</h2>${sections.join('')}`
}

export function formatCustomTestReportHtml(
  report: Report,
  result: CustomTestResult,
  labels: ReportFormatLabels
): string {
  const rows = result.entries
    .map((entry) => {
      const statusClass = statusCssClass(entry.status)
      return `<tr>
        <td class="host">${escapeHtml(labels.hostName(entry.hostId))}</td>
        <td class="muted">${escapeHtml(labels.profileName(entry.profileId))}</td>
        <td class="${statusClass}">${escapeHtml(statusLabel(entry.status))}</td>
        <td class="muted">${escapeHtml(commandSummary(entry))}</td>
        <td class="muted">${escapeHtml(formatDuration(entry.durationMs))}</td>
      </tr>`
    })
    .join('')

  const body = `<table>
    <thead>
      <tr>
        <th>Host</th><th>Profile</th><th>Status</th><th>Commands</th><th>Duration</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${buildCommandDetails(result, labels)}
  ${buildErrorSections(result, labels)}`

  const meta = `Type: Custom test · Run at: ${escapeHtml(formatRunTimestamp(result.runAt))}`

  return wrapReportHtml(report.name, meta, body)
}
