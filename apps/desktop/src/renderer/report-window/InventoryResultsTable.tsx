import { Fragment, useState } from 'react'
import { formatBytes } from '@consoleri/core'
import type { InventoryResult } from '@shared/types'

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

function joinList(items: string[]): string {
  return items.length > 0 ? items.join(', ') : '—'
}

interface InventoryResultsTableProps {
  result: InventoryResult
  hostName: (hostId: string) => string
  profileName: (profileId: string) => string
}

export function InventoryResultsTable({
  result,
  hostName,
  profileName
}: InventoryResultsTableProps): React.JSX.Element {
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#30363d] text-xs uppercase text-gray-500">
            <th className="px-3 py-2 font-medium">Host</th>
            <th className="px-3 py-2 font-medium">Profile</th>
            <th className="px-3 py-2 font-medium">OS</th>
            <th className="px-3 py-2 font-medium">RAM</th>
            <th className="px-3 py-2 font-medium">CPU</th>
            <th className="px-3 py-2 font-medium">Hostnames</th>
            <th className="px-3 py-2 font-medium">IPv4</th>
            <th className="px-3 py-2 font-medium">IPv6</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {result.entries.map((entry) => {
            const expanded = expandedHostId === entry.hostId
            const inv = entry.inventory
            return (
              <Fragment key={`${entry.hostId}-${entry.profileId}`}>
                <tr className="border-b border-[#30363d]">
                  <td className="px-3 py-2 text-sm text-gray-200">{hostName(entry.hostId)}</td>
                  <td className="px-3 py-2 text-sm text-gray-400">
                    {profileName(entry.profileId)}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-sm text-gray-300">
                    {inv?.os ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-300">
                    {inv ? formatBytes(inv.ramBytes) : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-sm text-gray-300">
                    {inv?.cpu ?? '—'}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-sm text-gray-400">
                    {joinList(inv?.hostnames ?? [])}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-sm text-gray-400">
                    {joinList(inv?.ipv4 ?? [])}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-sm text-gray-400">
                    {joinList(inv?.ipv6 ?? [])}
                  </td>
                  <td
                    className={`px-3 py-2 text-sm font-medium uppercase ${statusBadge(entry.status)}`}
                  >
                    {entry.status}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {(entry.error || (entry.log && entry.log.length > 0)) && (
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
                {expanded && (entry.error || entry.log) && (
                  <tr className="bg-[#161b22]">
                    <td colSpan={10} className="px-3 py-2">
                      {entry.error && (
                        <p className="mb-1 text-xs text-red-400">ERROR: {entry.error}</p>
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
    </div>
  )
}
