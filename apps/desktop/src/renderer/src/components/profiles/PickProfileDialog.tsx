import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { profileSummaryLines } from './profileDisplay'

interface PickProfileDialogProps {
  targetHostId?: string
  targetHostLabel?: string
  onClose: () => void
  onPick: (profile: ConnectionProfile) => void | Promise<void>
}

export function PickProfileDialog({
  targetHostId,
  targetHostLabel,
  onClose,
  onPick
}: PickProfileDialogProps): React.JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [hostFilter, setHostFilter] = useState('')
  const [profileId, setProfileId] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const hostList = await window.consoleri.hosts.list()
      setHosts(hostList)

      let list: ConnectionProfile[]
      if (hostFilter) {
        list = await window.consoleri.profiles.list(hostFilter)
      } else {
        list = await window.consoleri.profiles.list()
      }

      if (targetHostId) {
        const linked = await window.consoleri.profiles.list(targetHostId)
        const linkedIds = new Set(linked.map((p) => p.id))
        list = list.filter((p) => !linkedIds.has(p.id))
      }

      setProfiles(list)
      if (list.length > 0) {
        setProfileId(list[0].id)
      }
    })()
  }, [hostFilter, targetHostId])

  const hostById = useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts])

  const selectedProfile = profiles.find((p) => p.id === profileId)
  const targetHost = targetHostId ? hostById.get(targetHostId) : undefined
  const targetLabel = targetHost?.name ?? targetHostLabel

  const handlePick = async (): Promise<void> => {
    if (!selectedProfile) return
    setPicking(true)
    setError(null)
    try {
      await onPick(selectedProfile)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#30363d] bg-[#161b22] p-4 shadow-xl">
        <h3 className="mb-1 text-base font-medium text-gray-100">Pick existing profile</h3>
        {targetLabel && (
          <p className="mb-3 text-xs text-gray-500">
            Link to <span className="text-gray-400">{targetLabel}</span>
          </p>
        )}

        {profiles.length === 0 ? (
          <p className="mb-4 text-sm text-gray-400">No profiles available to link.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-400">Filter by linked host</span>
              <select
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={hostFilter}
                onChange={(e) => setHostFilter(e.target.value)}
                disabled={picking}
              >
                <option value="">All profiles</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.hostname})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">Profile</span>
              <select
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                disabled={picking}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.protocol})
                  </option>
                ))}
              </select>
            </label>
            {selectedProfile && (
              <p className="text-xs text-gray-500">
                {profileSummaryLines(selectedProfile, hosts).join(' · ')}
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={picking}
            className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-[#21262d] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={picking || !selectedProfile}
            onClick={() => void handlePick()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {picking ? 'Linking…' : 'Pick'}
          </button>
        </div>
      </div>
    </div>
  )
}
