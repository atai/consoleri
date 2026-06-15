import { useEffect, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { ProfileForm } from './ProfileForm'
import { ProfileListItem } from './ProfileListItem'
import { PickProfileDialog } from './PickProfileDialog'

interface HostProfilesSectionProps {
  host: Host
  profiles: ConnectionProfile[]
  onConnect: (host: Host, profileId: string) => void
  onProfilesChanged: () => void
}

export function HostProfilesSection({
  host,
  profiles,
  onConnect,
  onProfilesChanged
}: HostProfilesSectionProps): React.JSX.Element {
  const [hosts, setHosts] = useState<Host[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)

  useEffect(() => {
    window.consoleri.hosts.list().then(setHosts)
  }, [])

  const handleDetach = async (profileId: string): Promise<void> => {
    await window.consoleri.profiles.unlink(host.id, profileId)
    if (host.defaultProfileId === profileId) {
      await window.consoleri.hosts.update(host.id, { defaultProfileId: null })
    }
    onProfilesChanged()
  }

  const handlePick = async (source: ConnectionProfile): Promise<void> => {
    await window.consoleri.profiles.link(host.id, source.id)
    onProfilesChanged()
  }

  const handleSaved = (): void => {
    setShowAddForm(false)
    setEditingProfileId(null)
    onProfilesChanged()
  }

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Connection profiles
        </span>
        {!showAddForm && !editingProfileId && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPickDialog(true)}
              className="text-xs text-blue-400 hover:underline"
            >
              + Pick
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-xs text-blue-400 hover:underline"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="mb-2 rounded border border-[#30363d] bg-[#0d1117]">
          <ProfileForm
            linkHostId={host.id}
            host={host}
            hosts={hosts}
            onSave={handleSaved}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {profiles.length === 0 && !showAddForm ? (
        <p className="text-xs text-gray-500">No profiles yet</p>
      ) : (
        <ul>
          {profiles.map((profile) =>
            editingProfileId === profile.id ? (
              <li key={profile.id} className="rounded border border-[#30363d] bg-[#0d1117]">
                <ProfileForm
                  linkHostId={host.id}
                  profile={profile}
                  host={host}
                  hosts={hosts}
                  onSave={handleSaved}
                  onCancel={() => setEditingProfileId(null)}
                />
              </li>
            ) : (
              <ProfileListItem
                key={profile.id}
                profile={profile}
                host={host}
                hosts={hosts}
                compact
                onConnect={(profileId) => onConnect(host, profileId)}
                onEdit={() => setEditingProfileId(profile.id)}
                onDelete={() => handleDetach(profile.id)}
                deleteLabel="Remove"
                confirmDeleteLabel="Remove"
              />
            )
          )}
        </ul>
      )}

      {showPickDialog && (
        <PickProfileDialog
          targetHostId={host.id}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePick}
        />
      )}
    </div>
  )
}
