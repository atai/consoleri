import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { CheckboxPickList } from '../ui/CheckboxPickList'
import { DialogFooter } from '../ui/DialogFooter'
import { DialogHeader } from '../ui/DialogHeader'
import { LabeledSelect } from '../ui/LabeledSelect'
import { Modal } from '../ui/Modal'
import { usePickSelection } from '../ui/usePickSelection'
import { profileSummaryLines } from './profileDisplay'

const EMPTY_EXCLUDE_IDS: readonly string[] = []

interface PickProfileDialogProps {
  targetHostId?: string
  targetHostLabel?: string
  excludeProfileIds?: readonly string[]
  onClose: () => void
  onPick: (profiles: ConnectionProfile[]) => void | Promise<void>
}

export function PickProfileDialog({
  targetHostId,
  targetHostLabel,
  excludeProfileIds = EMPTY_EXCLUDE_IDS,
  onClose,
  onPick
}: PickProfileDialogProps): React.JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [hostFilter, setHostFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { selectedIds, toggle, pruneTo } = usePickSelection()

  const excludeKey = excludeProfileIds.join('\0')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const hostList = await window.consoleri.hosts.list()
        if (cancelled) return
        setHosts(hostList)

        let list: ConnectionProfile[]
        if (hostFilter) {
          list = await window.consoleri.profiles.list(hostFilter)
        } else {
          list = await window.consoleri.profiles.list()
        }
        if (cancelled) return

        if (targetHostId) {
          const linked = await window.consoleri.profiles.list(targetHostId)
          const linkedIds = new Set(linked.map((p) => p.id))
          list = list.filter((p) => !linkedIds.has(p.id))
        }

        const exclude = new Set(excludeProfileIds)
        list = list.filter((p) => !exclude.has(p.id))

        setProfiles(list)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hostFilter, targetHostId, excludeKey])

  useEffect(() => {
    pruneTo(profiles.map((p) => p.id))
  }, [profiles, pruneTo])

  const hostById = useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts])

  const targetHost = targetHostId ? hostById.get(targetHostId) : undefined
  const targetLabel = targetHost?.name ?? targetHostLabel

  const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id))

  const handlePick = async (): Promise<void> => {
    if (selectedProfiles.length === 0) return
    setPicking(true)
    setError(null)
    try {
      await onPick(selectedProfiles)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPicking(false)
    }
  }

  const hostOptions = hosts.map((h) => ({
    value: h.id,
    label: `${h.name} (${h.hostname})`
  }))

  return (
    <Modal size="md" scrollable onClose={picking ? undefined : onClose}>
      <DialogHeader
        title="Pick existing profile"
        subtitle={
          targetLabel ? (
            <>
              Link to <span className="text-gray-400">{targetLabel}</span>
            </>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        <LabeledSelect
          label="Filter by linked host"
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
          disabled={picking}
          emptyOption={{ value: '', label: 'All profiles' }}
          options={hostOptions}
        />

        <div>
          <span className="text-sm text-gray-400">Profiles</span>
          <div className="mt-1 max-h-48 overflow-y-auto rounded border border-[#30363d] bg-[#0d1117] p-1">
            <CheckboxPickList
              items={profiles}
              selectedIds={selectedIds}
              onToggle={toggle}
              loading={loading}
              loadingMessage="Loading profiles…"
              emptyMessage="No profiles available to link."
              renderItem={(profile) => (
                <div className="min-w-0">
                  <div className="text-sm text-gray-200">
                    {profile.name} ({profile.protocol})
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {profileSummaryLines(profile, hosts).join(' · ')}
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => void handlePick()}
        confirmLabel="Pick"
        confirmCount={selectedIds.size}
        loading={picking}
        loadingLabel="Linking…"
        disabled={selectedIds.size === 0}
      />
    </Modal>
  )
}
