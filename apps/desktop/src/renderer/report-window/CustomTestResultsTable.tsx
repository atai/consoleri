import { Fragment, useState } from 'react'
import type { CustomTestResult } from '@shared/types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusBadge(status: string): string {
  switch (status) {
    case 'ok':
      return 'text-green-400'
    case 'skipped':
      return 'text-yellow-400'
    default:
      return 'text-red-400'
  }
}

function exitCodeClass(code: number | null, status: string): string {
  if (status === 'skipped' || code === null) return 'text-yellow-400'
  if (code === 0) return 'text-green-400'
  return 'text-red-400'
}

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

function formatOutputPreview(stdout: string, stderr: string, maxLen = 120): string {
  const parts: string[] = []
  if (stdout.trim()) parts.push(stdout.trim())
  if (stderr.trim()) parts.push(`stderr: ${stderr.trim()}`)
  const combined = parts.join('\n')
  if (!combined) return '—'
  if (combined.length <= maxLen) return combined
  return `${combined.slice(0, maxLen)}…`
}

interface CustomTestResultsTableProps {
  result: CustomTestResult
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}

export function CustomTestResultsTable({
  result,
  hostName,
  profileName
}: CustomTestResultsTableProps): React.JSX.Element {
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null)
  const [expandedOutputKey, setExpandedOutputKey] = useState<string | null>(null)

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-[#30363d] text-xs uppercase text-gray-500">
          <th className="px-3 py-2 font-medium">Host</th>
          <th className="px-3 py-2 font-medium">Profile</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Commands</th>
          <th className="px-3 py-2 font-medium">Duration</th>
          <th className="px-3 py-2 font-medium">Details</th>
        </tr>
      </thead>
      <tbody>
        {result.entries.map((entry) => {
          const rowKey = `${entry.hostId}-${entry.profileId}`
          const expanded = expandedHostId === rowKey
          const hasDetails =
            entry.commands.length > 0 || entry.error || (entry.log && entry.log.length > 0)
          return (
            <Fragment key={rowKey}>
              <tr className="border-b border-[#30363d]">
                <td className="px-3 py-2 text-sm text-gray-200">{hostName(entry.hostId)}</td>
                <td className="px-3 py-2 text-sm text-gray-400">{profileName(entry.profileId)}</td>
                <td
                  className={`px-3 py-2 text-sm font-medium uppercase ${statusBadge(entry.status)}`}
                >
                  {entry.status}
                </td>
                <td className="px-3 py-2 text-sm text-gray-300">{commandSummary(entry)}</td>
                <td className="px-3 py-2 text-sm text-gray-400">
                  {formatDuration(entry.durationMs)}
                </td>
                <td className="px-3 py-2 text-sm">
                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() => setExpandedHostId(expanded ? null : rowKey)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {expanded ? 'Hide' : 'Show'}
                    </button>
                  )}
                </td>
              </tr>
              {expanded && hasDetails && (
                <tr className="bg-[#161b22]">
                  <td colSpan={6} className="px-3 py-2">
                    {entry.error && (
                      <p className="mb-2 text-xs text-red-400">ERROR: {entry.error}</p>
                    )}
                    {entry.log && entry.log.length > 0 && (
                      <pre className="mb-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-gray-400">
                        {entry.log.join('\n')}
                      </pre>
                    )}
                    {entry.commands.length > 0 && (
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-[#30363d] text-xs text-gray-500">
                            <th className="px-2 py-1 font-medium">#</th>
                            <th className="px-2 py-1 font-medium">Command</th>
                            <th className="px-2 py-1 font-medium">Exit</th>
                            <th className="px-2 py-1 font-medium">Status</th>
                            <th className="px-2 py-1 font-medium">Duration</th>
                            <th className="px-2 py-1 font-medium">Output</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.commands.map((cmd) => {
                            const outputKey = `${rowKey}-${cmd.index}`
                            const outputExpanded = expandedOutputKey === outputKey
                            const preview = formatOutputPreview(cmd.stdout, cmd.stderr)
                            const fullOutput = formatOutputPreview(cmd.stdout, cmd.stderr, Infinity)
                            const hasOutput = preview !== '—'
                            return (
                              <tr key={cmd.index} className="border-b border-[#30363d] last:border-0">
                                <td className="px-2 py-1.5 text-xs text-gray-500">{cmd.index + 1}</td>
                                <td className="max-w-[240px] truncate px-2 py-1.5 font-mono text-xs text-gray-300">
                                  {cmd.command}
                                </td>
                                <td
                                  className={`px-2 py-1.5 font-mono text-xs ${exitCodeClass(cmd.code, cmd.status)}`}
                                >
                                  {cmd.code !== null ? cmd.code : '—'}
                                </td>
                                <td
                                  className={`px-2 py-1.5 text-xs font-medium uppercase ${statusBadge(cmd.status)}`}
                                >
                                  {cmd.status}
                                </td>
                                <td className="px-2 py-1.5 text-xs text-gray-400">
                                  {cmd.status === 'skipped' ? '—' : formatDuration(cmd.durationMs)}
                                </td>
                                <td className="px-2 py-1.5 text-xs">
                                  {hasOutput ? (
                                    <div>
                                      {!outputExpanded && (
                                        <span className="font-mono text-gray-400">{preview}</span>
                                      )}
                                      {outputExpanded && (
                                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-gray-400">
                                          {fullOutput}
                                        </pre>
                                      )}
                                      {fullOutput.length > 120 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedOutputKey(outputExpanded ? null : outputKey)
                                          }
                                          className="ml-1 text-blue-400 hover:underline"
                                        >
                                          {outputExpanded ? 'Hide' : 'Show'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
