import type { ConnectivityTestResult, Report, ReportFormatLabels } from './types'
import { formatDuration, formatRunTimestamp, statusLabel } from './formatCommon'
import {
  connectivityResultHasHttpColumn,
  formatHttpStatusLabel
} from './httpStatusColor'

function formatPingLabel(pingStatus: string | undefined): string {
  if (!pingStatus) return '—'
  return statusLabel(pingStatus)
}

export function formatConnectivityReportMarkdown(
  report: Report,
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const showHttp = connectivityResultHasHttpColumn(result.entries)
  const lines: string[] = [
    `# ${report.name}`,
    '',
    `**Type:** Connectivity test`,
    `**Run at:** ${formatRunTimestamp(result.runAt)}`,
    '',
    showHttp
      ? '| Host | Profile | Ping | SSH | HTTP | Duration |'
      : '| Host | Profile | Ping | SSH | Duration |',
    showHttp
      ? '| --- | --- | --- | --- | --- | --- |'
      : '| --- | --- | --- | --- | --- |'
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const httpLabel = formatHttpStatusLabel(entry.httpStatusCode, entry.httpError)
    lines.push(
      showHttp
        ? `| ${host} | ${profile} | ${formatPingLabel(entry.pingStatus)} | ${statusLabel(entry.status)} | ${httpLabel} | ${formatDuration(entry.durationMs)} |`
        : `| ${host} | ${profile} | ${formatPingLabel(entry.pingStatus)} | ${statusLabel(entry.status)} | ${formatDuration(entry.durationMs)} |`
    )
  }

  const failures = result.entries.filter(
    (e) =>
      e.status === 'fail' ||
      e.pingStatus === 'fail' ||
      e.error ||
      e.pingError ||
      e.httpError
  )
  if (failures.length > 0) {
    lines.push('', '## Errors')
    for (const entry of failures) {
      const host = labels.hostName(entry.hostId)
      lines.push('', `### ${host}`)
      if (entry.pingError) {
        lines.push('', '**Ping:**', '```', entry.pingError, '```')
      }
      if (entry.httpError) {
        lines.push('', '**HTTP:**', '```', entry.httpError, '```')
      }
      if (entry.error) {
        lines.push('', '**SSH:**', '```', entry.error, '```')
      }
      if (entry.log && entry.log.length > 0) {
        lines.push('', '```', ...entry.log, '```')
      }
    }
  }

  return lines.join('\n')
}

export function formatConnectivityReportText(
  report: Report,
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const showHttp = connectivityResultHasHttpColumn(result.entries)
  const lines: string[] = [
    `[Connectivity test] ${report.name} — ${formatRunTimestamp(result.runAt)}`,
    '─'.repeat(48)
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const pingLabel = formatPingLabel(entry.pingStatus)
    const sshLabel = statusLabel(entry.status)
    const httpLabel = showHttp
      ? ` http:${formatHttpStatusLabel(entry.httpStatusCode, entry.httpError)}`
      : ''
    const padded = `${host}  (${profile})  ping:${pingLabel} ssh:${sshLabel}${httpLabel}`.padEnd(52)
    lines.push(`${padded}${formatDuration(entry.durationMs).padStart(8)}`)

    if (entry.pingError) {
      lines.push(`  PING ERROR: ${entry.pingError}`)
    }
    if (entry.httpError) {
      lines.push(`  HTTP ERROR: ${entry.httpError}`)
    }
    if (entry.status === 'fail' || entry.error) {
      if (entry.error) {
        lines.push(`  SSH ERROR: ${entry.error}`)
      }
      if (entry.log && entry.log.length > 0) {
        lines.push('  --- log ---')
        for (const logLine of entry.log) {
          lines.push(`  ${logLine}`)
        }
      }
    } else if (entry.pingStatus === 'fail' && entry.log && entry.log.length > 0) {
      lines.push('  --- log ---')
      for (const logLine of entry.log) {
        lines.push(`  ${logLine}`)
      }
    }
  }

  const pingOk = result.entries.filter((e) => e.pingStatus === 'ok').length
  const pingFail = result.entries.filter((e) => e.pingStatus === 'fail').length
  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length
  lines.push('─'.repeat(48))
  lines.push(`Summary: ping ${pingOk} ok, ${pingFail} fail | ssh ${ok} ok, ${fail} fail, ${skipped} skipped`)

  return lines.join('\n')
}

export function summarizeConnectivityResult(result: ConnectivityTestResult): string {
  const pingOk = result.entries.filter((e) => e.pingStatus === 'ok').length
  const pingFail = result.entries.filter((e) => e.pingStatus === 'fail').length
  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length
  return `ping ${pingOk}/${pingFail} | ssh ${ok} ok, ${fail} fail, ${skipped} skipped`
}
