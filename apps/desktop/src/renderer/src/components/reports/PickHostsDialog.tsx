import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'

export interface PickedHostEntry {
  hostId: string
  profileId: string
}

interface PickHostsDialogProps {
  existingHostIds: string[]
  onClose: () => void
  onPick: (entries: PickedHostEntry[]) => void
}

export function PickHostsDialog({
  existingHostIds,
  onClose,
  onPick
}: PickHostsDialogProps): React.JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([])
  const [profilesByHost, setProfilesByHost] = useState<Map<string, ConnectionProfile[]>>(new Map())
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const hostList = await window.consoleri.hosts.list()
        setHosts(hostList)
        const map = new Map<string, ConnectionProfile[]>()
        await Promise.all(
          hostList.map(async (host) => {
            const profiles = await window.consoleri.profiles.list(host.id)
            map.set(
              host.id,
              profiles.filter((p) => p.protocol === 'ssh')
            )
          })
        )
        setProfilesByHost(map)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const host of hosts) {
      for (const tag of host.tags) tags.add(tag)
    }
    return [...tags].sort((a, b) => a.localeCompare(b))
  }, [hosts])

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hosts.filter((host) => {
      if (tagFilter && !host.tags.includes(tagFilter)) return false
      if (!q) return true
      return (
        host.name.toLowerCase().includes(q) ||
        host.hostname.toLowerCase().includes(q) ||
        host.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [hosts, search, tagFilter])

  const toggleHost = (hostId: string): void => {
    const sshProfiles = profilesByHost.get(hostId) ?? []
    if (sshProfiles.length === 0) return
    if (existingHostIds.includes(hostId)) return

    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(hostId)) next.delete(hostId)
      else next.add(hostId)
      return next
    })
  }

  const handleConfirm = (): void => {
    const entries: PickedHostEntry[] = []
    for (const hostId of selected) {
      const sshProfiles = profilesByHost.get(hostId) ?? []
      if (sshProfiles.length === 0) continue
      const profileId =
        sshProfiles.length === 1
          ? sshProfiles[0]!.id
          : sshProfiles.find((p) => p.id === hosts.find((h) => h.id === hostId)?.defaultProfileId)
              ?.id ?? sshProfiles[0]!.id
      entries.push({ hostId, profileId })
    }
    onPick(entries)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl">
        <div className="shrink-0 border-b border-[#30363d] p-4">
          <h3 className="text-base font-medium text-gray-100">Pick hosts</h3>
          <p className="mt-1 text-xs text-gray-500">
            Only hosts with at least one SSH profile can be added.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-gray-100"
            />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-gray-100"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading hosts…</p>
          ) : filteredHosts.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No hosts match the filter.</p>
          ) : (
            <ul className="space-y-0.5">
              {filteredHosts.map((host) => {
                const sshProfiles = profilesByHost.get(host.id) ?? []
                const disabled = existingHostIds.includes(host.id) || sshProfiles.length === 0
                const checked = selected.has(host.id)

                return (
                  <li key={host.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#21262d]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleHost(host.id)}
                        className="rounded border-[#30363d]"
                      />
                      <span className="min-w-0 flex-1 text-sm text-gray-200">{host.name}</span>
                      <span className="truncate text-xs text-gray-500">{host.hostname}</span>
                      {sshProfiles.length === 0 && (
                        <span className="text-xs text-yellow-500">No SSH</span>
                      )}
                      {existingHostIds.includes(host.id) && (
                        <span className="text-xs text-gray-500">Added</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#30363d] p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-[#21262d]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handleConfirm}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
