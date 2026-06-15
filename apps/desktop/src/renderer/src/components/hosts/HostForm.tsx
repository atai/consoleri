import { useEffect, useState } from 'react'
import type { ConnectionProfile, Host, HostInput, HostLogVerbosity, OsType, ProfileInput, UxProfile } from '@shared/types'
import { HOST_LOG_VERBOSITY_OPTIONS } from '@consoleri/core'
import { useAppStore } from '../../stores/appStore'
import { ProfileForm } from '../profiles/ProfileForm'
import { PickProfileDialog } from '../profiles/PickProfileDialog'
import { TagInput } from './TagInput'
import {
  applyPendingProfiles,
  pendingProfileLabel,
  type PendingProfile
} from './pendingProfiles'

interface HostFormProps {
  host?: Host
  onSave: () => void
  onCancel: () => void
}

const OS_OPTIONS: OsType[] = ['windows', 'linux', 'macos', 'unknown']

function newPendingKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function HostForm({ host, onSave, onCancel }: HostFormProps): React.JSX.Element {
  const { allHostTags, refreshAllHostTags } = useAppStore()
  const [name, setName] = useState(host?.name ?? '')
  const [hostname, setHostname] = useState(host?.hostname ?? '')
  const [port, setPort] = useState(host?.port ?? 22)
  const [osType, setOsType] = useState<OsType>(host?.osType ?? 'linux')
  const [tags, setTags] = useState(host?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(host?.notes ?? '')
  const [logVerbosity, setLogVerbosity] = useState<HostLogVerbosity>(host?.logVerbosity ?? 'info')
  const [uxProfileId, setUxProfileId] = useState(host?.uxProfileId ?? '')
  const [uxProfiles, setUxProfiles] = useState<UxProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([])
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [showPickDialog, setShowPickDialog] = useState(false)

  useEffect(() => {
    void window.consoleri.uxProfiles.list().then(setUxProfiles)
    void refreshAllHostTags()
  }, [refreshAllHostTags])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: HostInput = {
        name,
        hostname,
        port,
        osType,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
        logVerbosity,
        uxProfileId: uxProfileId || null
      }

      if (host) {
        await window.consoleri.hosts.update(host.id, input)
      } else {
        const savedHost = await window.consoleri.hosts.create(input)
        await applyPendingProfiles(pendingProfiles, savedHost.id)
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleDraftProfile = (input: ProfileInput): void => {
    setPendingProfiles((prev) => [...prev, { key: newPendingKey(), kind: 'new', input }])
    setShowAddProfile(false)
  }

  const handlePickProfile = (profile: ConnectionProfile): void => {
    setPendingProfiles((prev) => [...prev, { key: newPendingKey(), kind: 'picked', profile }])
    setShowPickDialog(false)
  }

  const removePending = (key: string): void => {
    setPendingProfiles((prev) => prev.filter((p) => p.key !== key))
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 p-4 text-sm">
        <h3 className="text-base font-medium text-gray-200">{host ? 'Edit host' : 'Add host'}</h3>
        <label className="block">
          <span className="text-gray-400">Name</span>
          <input
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-gray-400">Hostname / IP</span>
          <input
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-gray-400">Port</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-gray-400">OS</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={osType}
              onChange={(e) => setOsType(e.target.value as OsType)}
            >
              {OS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-gray-400">Log verbosity</span>
          <select
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={logVerbosity}
            onChange={(e) => setLogVerbosity(e.target.value as HostLogVerbosity)}
          >
            {HOST_LOG_VERBOSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </select>
        </label>

        {host && (
          <label className="block">
            <span className="text-gray-400">UX profile</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={uxProfileId}
              onChange={(e) => setUxProfileId(e.target.value)}
            >
              <option value="">Use global active profile</option>
              {uxProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!host && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Connection profiles
              </span>
              {!showAddProfile && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPickDialog(true)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    + Pick profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProfile(true)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    + Add profile
                  </button>
                </div>
              )}
            </div>

            {showAddProfile && (
              <div className="mb-2 rounded border border-[#30363d] bg-[#0d1117]">
                <ProfileForm
                  draft
                  onDraftSave={handleDraftProfile}
                  onSave={() => setShowAddProfile(false)}
                  onCancel={() => setShowAddProfile(false)}
                />
              </div>
            )}

            {pendingProfiles.length === 0 && !showAddProfile ? (
              <p className="text-xs text-gray-500">No profiles yet</p>
            ) : (
              <ul className="space-y-1">
                {pendingProfiles.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-2 rounded bg-[#0d1117] px-2 py-1.5 text-xs text-gray-300"
                  >
                    <span className="truncate">{pendingProfileLabel(item)}</span>
                    <button
                      type="button"
                      onClick={() => removePending(item.key)}
                      className="shrink-0 text-gray-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-gray-400">Tags (comma-separated)</span>
          <TagInput
            id="host-tags"
            value={tags}
            onChange={setTags}
            existingTags={allHostTags}
            placeholder="prod, db, eu-west"
          />
        </label>
        <label className="block">
          <span className="text-gray-400">Notes</span>
          <textarea
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {showPickDialog && !host && (
        <PickProfileDialog
          targetHostLabel={name.trim() || 'new host'}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePickProfile}
        />
      )}
    </>
  )
}
