import { Fragment, useState } from 'react'
import type { ConnectivityTestResult } from '@shared/types'

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

function formatPingStatus(pingStatus: string | undefined): string {
  if (!pingStatus) return '—'
  return pingStatus
}

interface ConnectivityResultsTableProps {
  result: ConnectivityTestResult
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}

export function ConnectivityResultsTable({
  result,
  hostName,
  profileName
}: ConnectivityResultsTableProps): React.JSX.Element {
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null)

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-[#30363d] text-xs uppercase text-gray-500">
          <th className="px-3 py-2 font-medium">Host</th>
          <th className="px-3 py-2 font-medium">Profile</th>
          <th className="px-3 py-2 font-medium">Ping</th>
          <th className="px-3 py-2 font-medium">SSH</th>
          <th className="px-3 py-2 font-medium">Duration</th>
          <th className="px-3 py-2 font-medium">Details</th>
        </tr>
      </thead>
      <tbody>
        {result.entries.map((entry) => {
          const expanded = expandedHostId === entry.hostId
          const hasDetails =
            entry.error ||
            entry.pingError ||
            (entry.log && entry.log.length > 0)
          return (
            <Fragment key={`${entry.hostId}-${entry.profileId}`}>
              <tr className="border-b border-[#30363d]">
                <td className="px-3 py-2 text-sm text-gray-200">{hostName(entry.hostId)}</td>
                <td className="px-3 py-2 text-sm text-gray-400">{profileName(entry.profileId)}</td>
                <td
                  className={`px-3 py-2 text-sm font-medium uppercase ${
                    entry.pingStatus ? statusBadge(entry.pingStatus) : 'text-gray-500'
                  }`}
                >
                  {formatPingStatus(entry.pingStatus)}
                </td>
                <td
                  className={`px-3 py-2 text-sm font-medium uppercase ${statusBadge(entry.status)}`}
                >
                  {entry.status}
                </td>
                <td className="px-3 py-2 text-sm text-gray-400">
                  {formatDuration(entry.durationMs)}
                </td>
                <td className="px-3 py-2 text-sm">
                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() => setExpandedHostId(expanded ? null : entry.hostId)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {expanded ? 'Hide' : 'Show log'}
                    </button>
                  )}
                </td>
              </tr>
              {expanded && hasDetails && (
                <tr className="bg-[#161b22]">
                  <td colSpan={6} className="px-3 py-2">
                    {entry.pingError && (
                      <p className="mb-1 text-xs text-red-400">PING ERROR: {entry.pingError}</p>
                    )}
                    {entry.error && (
                      <p className="mb-1 text-xs text-red-400">SSH ERROR: {entry.error}</p>
                    )}
                    {entry.log && entry.log.length > 0 && (
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-gray-400">
                        {entry.log.join('\n')}
                      </pre>
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
