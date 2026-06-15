import { useEffect, useState } from 'react'
import type { AssignableHost, SshKeyInfo } from '@shared/types'

interface AssignKeyDialogProps {
  keyInfo: SshKeyInfo
  onClose: () => void
  onAssigned: () => void
}

export function AssignKeyDialog({
  keyInfo,
  onClose,
  onAssigned
}: AssignKeyDialogProps): React.JSX.Element {
  const [hosts, setHosts] = useState<AssignableHost[]>([])
  const [hostId, setHostId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.consoleri.keys.listAssignableHosts().then((list) => {
      setHosts(list)
      if (list.length > 0) {
        setHostId(list[0].hostId)
        setProfileId(list[0].profiles[0]?.profileId ?? '')
      }
    })
  }, [])

  const selectedHost = hosts.find((h) => h.hostId === hostId)
  const profiles = selectedHost?.profiles ?? []

  useEffect(() => {
    if (profiles.length > 0 && !profiles.some((p) => p.profileId === profileId)) {
      setProfileId(profiles[0].profileId)
    }
  }, [hostId, profiles, profileId])

  const handleAssign = async (): Promise<void> => {
    if (!profileId) return
    setSaving(true)
    setError(null)
    try {
      await window.consoleri.keys.assign(profileId, keyInfo.privateKeyPath)
      onAssigned()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-[#30363d] bg-[#161b22] p-4 shadow-xl">
        <h3 className="mb-3 text-base font-medium text-gray-100">Assign key to host</h3>
        <p className="mb-3 truncate text-xs text-gray-500">{keyInfo.label}</p>

        {hosts.length === 0 ? (
          <p className="mb-4 text-sm text-gray-400">No hosts with SSH profiles. Add a host first.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-400">Host</span>
              <select
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
              >
                {hosts.map((h) => (
                  <option key={h.hostId} value={h.hostId}>
                    {h.hostName} ({h.hostname})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-400">SSH profile</span>
              <select
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.profileName}
                    {p.username ? ` (${p.username})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-[#21262d]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !profileId}
            onClick={handleAssign}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}
