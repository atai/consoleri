import type { InventoryResult, Report, ReportFormatLabels } from './types'
import { formatBytes, formatDuration, formatRunTimestamp, joinList, statusLabel } from './formatCommon'

export function formatInventoryReportMarkdown(
  report: Report,
  result: InventoryResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `# ${report.name}`,
    '',
    `**Type:** Inventory`,
    `**Run at:** ${formatRunTimestamp(result.runAt)}`,
    '',
    '| Host | Profile | OS | RAM | CPU | Hostnames | IPv4 | IPv6 | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const inv = entry.inventory
    lines.push(
      `| ${host} | ${profile} | ${inv?.os ?? '—'} | ${inv ? formatBytes(inv.ramBytes) : '—'} | ${inv?.cpu ?? '—'} | ${joinList(inv?.hostnames ?? [])} | ${joinList(inv?.ipv4 ?? [])} | ${joinList(inv?.ipv6 ?? [])} | ${statusLabel(entry.status)} |`
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

export function formatInventoryReportText(
  report: Report,
  result: InventoryResult,
  labels: ReportFormatLabels
): string {
  const lines: string[] = [
    `[Inventory] ${report.name} — ${formatRunTimestamp(result.runAt)}`,
    '─'.repeat(48)
  ]

  for (const entry of result.entries) {
    const host = labels.hostName(entry.hostId)
    const profile = labels.profileName(entry.profileId)
    const icon = entry.status === 'ok' ? '✓' : entry.status === 'skipped' ? '○' : '✗'
    lines.push(`${icon} ${host} (${profile}) — ${statusLabel(entry.status)} ${formatDuration(entry.durationMs)}`)

    if (entry.inventory) {
      const inv = entry.inventory
      lines.push(`  OS: ${inv.os}`)
      lines.push(`  RAM: ${formatBytes(inv.ramBytes)}`)
      lines.push(`  CPU: ${inv.cpu}`)
      lines.push(`  Hostnames: ${joinList(inv.hostnames)}`)
      lines.push(`  IPv4: ${joinList(inv.ipv4)}`)
      lines.push(`  IPv6: ${joinList(inv.ipv6)}`)
    }

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
    lines.push('')
  }

  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length
  lines.push('─'.repeat(48))
  lines.push(`Summary: ${ok} collected, ${fail} failed${skipped > 0 ? `, ${skipped} skipped` : ''}`)

  return lines.join('\n')
}

export function summarizeInventoryResult(result: InventoryResult): string {
  const ok = result.entries.filter((e) => e.status === 'ok').length
  const fail = result.entries.filter((e) => e.status === 'fail').length
  const skipped = result.entries.filter((e) => e.status === 'skipped').length
  return `${ok} collected, ${fail} failed${skipped > 0 ? `, ${skipped} skipped` : ''}`
}
