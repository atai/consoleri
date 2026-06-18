import type { CustomTestResult, Report, ReportFormatLabels } from './types'
import { formatDuration, formatRunTimestamp, statusLabel } from './formatCommon'

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

export function formatCustomTestReportMarkdown(
  report: Report,
  result: CustomTestResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `# ${report.name}`,
    '',
    `**Type:** Custom test`,
    `**Run at:** ${formatRunTimestamp(result.runAt)}`,
    '',
    '| Host | Profile | Status | Commands | Duration |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    lines.push(
      `| ${host} | ${profile} | ${statusLabel(entry.status)} | ${commandSummary(entry)} | ${formatDuration(entry.durationMs)} |`
    )
  }

  const withCommands = result.entries.filter((e) => e.commands.length > 0)
  if (withCommands.length > 0) {
    lines.push('', '## Command details')
    for (const entry of withCommands) {
      const host = labels.hostName(entry.hostId)
      lines.push('', `### ${host}`)
      lines.push('', '| # | Command | Exit | Status | Duration | Output |')
      lines.push('| --- | --- | --- | --- | --- | --- |')
      for (const cmd of entry.commands) {
        const exitCode = cmd.code !== null ? String(cmd.code) : '—'
        const output = formatCommandOutput(cmd.stdout, cmd.stderr).replace(/\|/g, '\\|').replace(/\n/g, ' ')
        lines.push(
          `| ${cmd.index + 1} | \`${cmd.command.replace(/`/g, '\\`')}\` | ${exitCode} | ${statusLabel(cmd.status)} | ${formatDuration(cmd.durationMs)} | ${output} |`
        )
      }
    }
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

export function formatCustomTestReportText(
  report: Report,
  result: CustomTestResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `[Custom test] ${report.name} — ${formatRunTimestamp(result.runAt)}`,
    '─'.repeat(48)
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const icon = entry.status === 'ok' ? '✓' : entry.status === 'skipped' ? '○' : '✗'
    lines.push(
      `${icon} ${host} (${profile}) — ${statusLabel(entry.status)} · ${commandSummary(entry)} · ${formatDuration(entry.durationMs)}`
    )
    for (const cmd of entry.commands) {
      const exitCode = cmd.code !== null ? String(cmd.code) : '—'
      const cmdIcon = cmd.status === 'ok' ? '✓' : cmd.status === 'skipped' ? '○' : '✗'
      lines.push(
        `    ${cmdIcon} [${cmd.index + 1}] exit ${exitCode} — ${cmd.command} (${formatDuration(cmd.durationMs)})`
      )
      const output = formatCommandOutput(cmd.stdout, cmd.stderr)
      if (output !== '—') {
        for (const line of output.split('\n')) {
          lines.push(`      ${line}`)
        }
      }
    }
    if (entry.error) {
      lines.push(`    ERROR: ${entry.error}`)
    }
  }

  return lines.join('\n')
}

export function summarizeCustomTestResult(result: CustomTestResult): string {
  const hostTotal = result.entries.length
  if (hostTotal === 0) return 'No hosts'
  const hostsOk = result.entries.filter((e) => e.status === 'ok').length
  const cmdTotal = result.entries.reduce((sum, e) => sum + e.commands.length, 0)
  const cmdOk = result.entries.reduce(
    (sum, e) => sum + e.commands.filter((c) => c.status === 'ok').length,
    0
  )
  if (cmdTotal === 0) {
    return `${hostsOk}/${hostTotal} hosts ok`
  }
  return `${hostsOk}/${hostTotal} hosts ok · ${cmdOk}/${cmdTotal} commands ok`
}
