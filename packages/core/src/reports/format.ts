import type {
  ConnectivityTestResult,
  Report,
  ReportFormatLabels
} from './types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'OK'
    case 'fail':
      return 'FAIL'
    case 'skipped':
      return 'SKIPPED'
    default:
      return status.toUpperCase()
  }
}

function formatRunTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function formatReportMarkdown(
  report: Report,
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `# ${report.name}`,
    '',
    `**Type:** Connectivity test`,
    `**Run at:** ${formatRunTimestamp(result.runAt)}`,
    '',
    '| Host | Profile | Status | Duration |',
    '| --- | --- | --- | --- |'
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    lines.push(
      `| ${host} | ${profile} | ${statusLabel(entry.status)} | ${formatDuration(entry.durationMs)} |`
    )
  }

  const failures = result.entries.filter((e) => e.status === 'fail' || e.error)
  if (failures.length > 0) {
    lines.push('', '## Errors')
    for (const entry of failures) {
      const host = labels.hostName(entry.hostId)
      lines.push('', `### ${host}`)
      if (entry.error) {
        lines.push('', '```', entry.error, '```')
      }
      if (entry.log && entry.log.length > 0) {
        lines.push('', '```', ...entry.log, '```')
      }
    }
  }

  return lines.join('\n')
}

export function formatReportText(
  report: Report,
  result: ConnectivityTestResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `[Connectivity test] ${report.name} — ${formatRunTimestamp(result.runAt)}`,
    '─'.repeat(48)
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const icon = entry.status === 'ok' ? '✓' : entry.status === 'skipped' ? '○' : '✗'
    const padded = `${icon} ${host}  (${profile})`.padEnd(36)
    lines.push(`${padded}${formatDuration(entry.durationMs).padStart(8)}`)

    if (entry.status === 'fail' || entry.error) {
      if (entry.error) {
        lines.push(`  ERROR: ${entry.error}`)
      }
      if (entry.log && entry.log.length > 0) {
        lines.push('  --- log ---')
        for (const logLine of entry.log) {
          lines.push(`  ${logLine}`)
        }
      }
    }
  }

  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length
  lines.push('─'.repeat(48))
  lines.push(`Summary: ${ok} ok, ${fail} fail, ${skipped} skipped`)

  return lines.join('\n')
}
