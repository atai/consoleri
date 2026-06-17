import { useCallback, useEffect, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { ProfileForm } from './ProfileForm'
import { ProfileListItem } from './ProfileListItem'
import { PickProfileDialog } from './PickProfileDialog'

export function ProfileManager(): React.JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [profileHosts, setProfileHosts] = useState<Map<string, Host[]>>(new Map())
  const [hostFilter, setHostFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const hostList = await window.consoleri.hosts.list()
      setHosts(hostList)
      const profileList = hostFilter
        ? await window.consoleri.profiles.list(hostFilter)
        : await window.consoleri.profiles.list()
      setProfiles(profileList)

      const hostMap = new Map<string, Host[]>()
      await Promise.all(
        profileList.map(async (profile) => {
          hostMap.set(profile.id, await window.consoleri.profiles.listHosts(profile.id))
        })
      )
      setProfileHosts(hostMap)
    } finally {
      setLoading(false)
    }
  }, [hostFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hostById = new Map(hosts.map((h) => [h.id, h]))

  const handleDelete = async (profile: ConnectionProfile): Promise<void> => {
    const linkedHosts = profileHosts.get(profile.id) ?? []
    for (const h of linkedHosts) {
      if (h.defaultProfileId === profile.id) {
        await window.consoleri.hosts.update(h.id, { defaultProfileId: null })
      }
    }
    await window.consoleri.profiles.delete(profile.id)
    await refresh()
  }

  const handleUnlink = async (profile: ConnectionProfile, hostId: string): Promise<void> => {
    await window.consoleri.profiles.unlink(hostId, profile.id)
    const host = hostById.get(hostId)
    if (host?.defaultProfileId === profile.id) {
      await window.consoleri.hosts.update(hostId, { defaultProfileId: null })
    }
    await refresh()
  }

  const handlePick = async (sources: ConnectionProfile[]): Promise<void> => {
    if (!hostFilter) return
    await Promise.all(
      sources.map((source) => window.consoleri.profiles.link(hostFilter, source.id))
    )
    await refresh()
  }

  const handleSaved = async (): Promise<void> => {
    setShowAddForm(false)
    setEditingProfileId(null)
    await refresh()
  }

  const renderProfile = (profile: ConnectionProfile): React.JSX.Element => {
    const filterHost = hostFilter ? hostById.get(hostFilter) : undefined
    const linkedFromApi = profileHosts.get(profile.id) ?? []
    const linkedHosts =
      filterHost && profiles.some((p) => p.id === profile.id)
        ? [
            filterHost,
            ...linkedFromApi.filter((h) => h.id !== filterHost.id)
          ]
        : linkedFromApi
    const editHost = filterHost ?? linkedHosts[0]

    if (editingProfileId === profile.id) {
      return (
        <li key={profile.id} className="border-b border-[#30363d] bg-[#0d1117]">
          <ProfileForm
            linkHostId={hostFilter || editHost?.id}
            profile={profile}
            host={editHost}
            hosts={hosts}
            onSave={() => void handleSaved()}
            onCancel={() => setEditingProfileId(null)}
          />
        </li>
      )
    }

    return (
      <ProfileListItem
        key={profile.id}
        profile={profile}
        host={filterHost}
        hosts={hosts}
        linkedHosts={linkedHosts}
        showLinkedHosts
        onEdit={() => setEditingProfileId(profile.id)}
        onDelete={() => handleDelete(profile)}
        onUnlink={
          hostFilter ? () => handleUnlink(profile, hostFilter) : undefined
        }
        deleteLabel={hostFilter ? 'Remove' : 'Delete'}
        confirmDeleteLabel={hostFilter ? 'Remove' : 'Delete'}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#161b22]">
      <div className="shrink-0 border-b border-[#30363d] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">Profiles</h1>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-[#30363d] px-2 py-0.5 text-xs text-gray-400 hover:bg-[#21262d]"
          >
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500">Profiles are shared across hosts</p>
      </div>

      <div className="shrink-0 space-y-2 border-b border-[#30363d] p-2">
        <label className="block text-sm">
          <span className="text-gray-400">Host filter</span>
          <select
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={hostFilter}
            onChange={(e) => setHostFilter(e.target.value)}
          >
            <option value="">All profiles</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.hostname})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hostFilter || showAddForm}
            onClick={() => setShowPickDialog(true)}
            className="flex-1 rounded border border-[#30363d] px-2 py-1.5 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-50"
          >
            + Pick
          </button>
          <button
            type="button"
            disabled={showAddForm}
            onClick={() => setShowAddForm(true)}
            className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
          >
            + Add profile
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="shrink-0 border-b border-[#30363d] bg-[#0d1117]">
          <ProfileForm
            linkHostId={hostFilter || undefined}
            host={hostFilter ? hostById.get(hostFilter) : undefined}
            hosts={hosts}
            onSave={() => void handleSaved()}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {showPickDialog && hostFilter && (
        <PickProfileDialog
          targetHostId={hostFilter}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePick}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-sm text-gray-500">Loading profiles…</p>
        ) : profiles.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">No profiles yet</p>
        ) : (
          <ul>{profiles.map((p) => renderProfile(p))}</ul>
        )}
      </div>
    </div>
  )
}
