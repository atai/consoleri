import { useEffect, useState } from 'react'
import type {
  ConnectionProfile,
  Host,
  Report,
  ReportConfig,
  ReportHostEntry,
  ReportType
} from '@shared/types'
import { PickHostsDialog } from './PickHostsDialog'

interface HostEntriesReportFormProps {
  reportType: ReportType
  title: string
  report?: Report
  onSave: () => void | Promise<void>
  onCancel: () => void
}

function getInitialEntries(report: Report | undefined, reportType: ReportType): ReportHostEntry[] {
  if (!report || report.config.type !== reportType) return []
  return report.config.entries
}

export function HostEntriesReportForm({
  reportType,
  title,
  report,
  onSave,
  onCancel
}: HostEntriesReportFormProps): React.JSX.Element {
  const [name, setName] = useState(report?.name ?? '')
  const [entries, setEntries] = useState<ReportHostEntry[]>(() =>
    getInitialEntries(report, reportType)
  )
  const [hosts, setHosts] = useState<Host[]>([])
  const [profilesByHost, setProfilesByHost] = useState<Map<string, ConnectionProfile[]>>(new Map())
  const [showPickHosts, setShowPickHosts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const hostList = await window.consoleri.hosts.list()
      setHosts(hostList)
      const map = new Map<string, ConnectionProfile[]>()
      const hostIds = new Set(entries.map((e) => e.hostId))
      await Promise.all(
        [...hostIds].map(async (hostId) => {
          const profiles = await window.consoleri.profiles.list(hostId)
          map.set(
            hostId,
            profiles.filter((p) => p.protocol === 'ssh')
          )
        })
      )
      setProfilesByHost(map)
    })()
  }, [entries])

  const hostById = new Map(hosts.map((h) => [h.id, h]))

  const loadProfilesForHost = async (hostId: string): Promise<ConnectionProfile[]> => {
    const profiles = await window.consoleri.profiles.list(hostId)
    const sshProfiles = profiles.filter((p) => p.protocol === 'ssh')
    setProfilesByHost((prev) => new Map(prev).set(hostId, sshProfiles))
    return sshProfiles
  }

  const handleAddHosts = async (
    picked: Array<{ hostId: string; profileId: string }>
  ): Promise<void> => {
    const newEntries = [...entries]
    for (const pick of picked) {
      if (newEntries.some((e) => e.hostId === pick.hostId)) continue
      const sshProfiles = profilesByHost.get(pick.hostId) ?? (await loadProfilesForHost(pick.hostId))
      if (sshProfiles.length === 0) continue
      const profileId =
        sshProfiles.length === 1
          ? sshProfiles[0]!.id
          : (sshProfiles.find((p) => p.id === pick.profileId)?.id ?? sshProfiles[0]!.id)
      newEntries.push({ hostId: pick.hostId, profileId })
    }
    setEntries(newEntries)
  }

  const handleRemove = (hostId: string): void => {
    setEntries(entries.filter((e) => e.hostId !== hostId))
  }

  const handleProfileChange = (hostId: string, profileId: string): void => {
    setEntries(entries.map((e) => (e.hostId === hostId ? { ...e, profileId } : e)))
  }

  const handleSubmit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Report name is required')
      return
    }
    if (entries.length === 0) {
      setError('Add at least one host')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const config = { type: reportType, entries } as ReportConfig
      if (report) {
        await window.consoleri.reports.update(report.id, { name: trimmed, config })
      } else {
        await window.consoleri.reports.create({
          name: trimmed,
          type: reportType,
          config
        })
      }
      await onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-[#30363d] bg-[#0d1117] p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-100">{title}</h3>

      <label className="mb-3 block text-sm">
        <span className="text-gray-400">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-gray-100"
          placeholder="e.g. Production hosts"
        />
      </label>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-gray-400">Hosts ({entries.length})</span>
        <button
          type="button"
          onClick={() => setShowPickHosts(true)}
          disabled={saving}
          className="rounded border border-[#30363d] px-2 py-0.5 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          + Add hosts
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="mb-3 text-xs text-gray-500">No hosts added yet.</p>
      ) : (
        <div className="mb-3 overflow-x-auto rounded border border-[#30363d]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-xs text-gray-500">
                <th className="px-2 py-1.5 font-medium">Host</th>
                <th className="px-2 py-1.5 font-medium">SSH profile</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const host = hostById.get(entry.hostId)
                const sshProfiles = profilesByHost.get(entry.hostId) ?? []
                return (
                  <tr key={entry.hostId} className="border-b border-[#30363d] last:border-0">
                    <td className="px-2 py-1.5 text-gray-200">
                      {host?.name ?? entry.hostId}
                      {host && (
                        <span className="ml-1 text-xs text-gray-500">({host.hostname})</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {sshProfiles.length <= 1 ? (
                        <span className="text-gray-400">
                          {sshProfiles[0]?.name ?? entry.profileId}
                        </span>
                      ) : (
                        <select
                          value={entry.profileId}
                          onChange={(e) => handleProfileChange(entry.hostId, e.target.value)}
                          disabled={saving}
                          className="w-full rounded border border-[#30363d] bg-[#161b22] px-1.5 py-0.5 text-gray-100"
                        >
                          {sshProfiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.hostId)}
                        disabled={saving}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-[#21262d] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {showPickHosts && (
        <PickHostsDialog
          existingHostIds={entries.map((e) => e.hostId)}
          onClose={() => setShowPickHosts(false)}
          onPick={(picked) => void handleAddHosts(picked)}
        />
      )}
    </div>
  )
}