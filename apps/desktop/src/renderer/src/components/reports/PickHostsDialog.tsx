import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { CheckboxPickList } from '../ui/CheckboxPickList'
import { DialogFooter } from '../ui/DialogFooter'
import { DialogHeader } from '../ui/DialogHeader'
import { Modal } from '../ui/Modal'
import { usePickSelection } from '../ui/usePickSelection'

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
  const [loading, setLoading] = useState(true)
  const { selectedIds, toggle, pruneTo } = usePickSelection()

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

  const disabledIds = useMemo(() => {
    const ids = new Set<string>()
    for (const host of filteredHosts) {
      const sshProfiles = profilesByHost.get(host.id) ?? []
      if (existingHostIds.includes(host.id) || sshProfiles.length === 0) {
        ids.add(host.id)
      }
    }
    return ids
  }, [filteredHosts, profilesByHost, existingHostIds])

  useEffect(() => {
    pruneTo(filteredHosts.map((h) => h.id))
  }, [filteredHosts, pruneTo])

  const handleToggle = (hostId: string): void => {
    if (disabledIds.has(hostId)) return
    toggle(hostId)
  }

  const handleConfirm = (): void => {
    const entries: PickedHostEntry[] = []
    for (const hostId of selectedIds) {
      const sshProfiles = profilesByHost.get(hostId) ?? []
      if (sshProfiles.length === 0) continue
      const profileId =
        sshProfiles.length === 1
          ? sshProfiles[0]!.id
          : (sshProfiles.find((p) => p.id === hosts.find((h) => h.id === hostId)?.defaultProfileId)
              ?.id ?? sshProfiles[0]!.id)
      entries.push({ hostId, profileId })
    }
    onPick(entries)
    onClose()
  }

  return (
    <Modal size="lg" scrollable onClose={onClose}>
      <DialogHeader
        bordered
        title="Pick hosts"
        subtitle="Only hosts with at least one SSH profile can be added."
      />
      <div className="shrink-0 px-4 pb-3">
        <div className="flex gap-2">
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
        <CheckboxPickList
          items={filteredHosts}
          selectedIds={selectedIds}
          disabledIds={disabledIds}
          onToggle={handleToggle}
          loading={loading}
          loadingMessage="Loading hosts…"
          emptyMessage="No hosts match the filter."
          renderItem={(host) => (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-sm text-gray-200">{host.name}</span>
              <span className="truncate text-xs text-gray-500">{host.hostname}</span>
            </div>
          )}
          renderDisabledBadge={(host) => {
            const sshProfiles = profilesByHost.get(host.id) ?? []
            if (sshProfiles.length === 0) {
              return <span className="text-xs text-yellow-500">No SSH</span>
            }
            if (existingHostIds.includes(host.id)) {
              return <span className="text-xs text-gray-500">Added</span>
            }
            return null
          }}
        />
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel="Add"
        confirmCount={selectedIds.size}
        disabled={selectedIds.size === 0}
      />
    </Modal>
  )
}
