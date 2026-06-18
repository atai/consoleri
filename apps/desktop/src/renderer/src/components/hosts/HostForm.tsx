import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host, HostInput, HostLogVerbosity, OsType, ProfileInput, UxProfile } from '@shared/types'
import { HOST_LOG_VERBOSITY_OPTIONS, normalizeHttpEndpoint, parseTagsInput } from '@consoleri/core'
import { useAppStore } from '../../stores/appStore'
import { ProfileForm } from '../profiles/ProfileForm'
import { PickProfileDialog } from '../profiles/PickProfileDialog'
import { TagInput } from './TagInput'
import { HostProfilesSection } from '../profiles/HostProfilesSection'
import { hostCopyName } from './hostTemplate'
import {
  applyPendingProfiles,
  mergePickedProfiles,
  newPendingKey,
  pendingProfileLabel,
  type PendingProfile
} from './pendingProfiles'

interface HostFormProps {
  host?: Host
  copyFrom?: Host
  initialPendingProfiles?: PendingProfile[]
  profiles?: ConnectionProfile[]
  onProfilesChanged?: () => void
  onConnect?: (host: Host, profileId?: string) => void
  onSave: () => void
  onCancel: () => void
}

const OS_OPTIONS: OsType[] = ['windows', 'linux', 'macos', 'unknown']

export function HostForm({
  host,
  copyFrom,
  initialPendingProfiles,
  profiles,
  onProfilesChanged,
  onConnect,
  onSave,
  onCancel
}: HostFormProps): React.JSX.Element {
  const { allHostTags, allHosts, refreshAllHostTags, refreshAllHosts } = useAppStore()
  const source = host ?? copyFrom
  const isCopyMode = Boolean(copyFrom)
  const [name, setName] = useState(
    host?.name ?? (copyFrom ? hostCopyName(copyFrom) : '')
  )
  const [hostname, setHostname] = useState(source?.hostname ?? '')
  const [httpEndpoint, setHttpEndpoint] = useState(source?.httpEndpoint ?? '')
  const [port, setPort] = useState(source?.port ?? 22)
  const [osType, setOsType] = useState<OsType>(source?.osType ?? 'linux')
  const [tags, setTags] = useState(source?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [logVerbosity, setLogVerbosity] = useState<HostLogVerbosity>(source?.logVerbosity ?? 'info')
  const [uxProfileId, setUxProfileId] = useState(source?.uxProfileId ?? '')
  const [uxProfiles, setUxProfiles] = useState<UxProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [httpEndpointError, setHttpEndpointError] = useState<string | null>(null)
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>(
    initialPendingProfiles ?? []
  )
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [relatedHostIds, setRelatedHostIds] = useState<string[]>(source?.relatedHostIds ?? [])
  const [gatewayHostId, setGatewayHostId] = useState(source?.gatewayHostId ?? '')

  const excludeHostId = host?.id ?? copyFrom?.id
  const otherHosts = allHosts.filter((h) => h.id !== excludeHostId)
  const gatewayOptions = otherHosts.filter((h) => h.gatewayHostId !== excludeHostId)

  useEffect(() => {
    void window.consoleri.uxProfiles.list().then(setUxProfiles)
    void refreshAllHostTags()
    void refreshAllHosts()
  }, [refreshAllHostTags, refreshAllHosts])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setHttpEndpointError(null)
    let normalizedHttpEndpoint: string | null
    try {
      normalizedHttpEndpoint = normalizeHttpEndpoint(httpEndpoint)
    } catch (err) {
      setHttpEndpointError(err instanceof Error ? err.message : String(err))
      return
    }
    setSaving(true)
    try {
      const input: HostInput = {
        name,
        hostname,
        port,
        osType,
        tags: parseTagsInput(tags),
        notes,
        logVerbosity,
        uxProfileId: uxProfileId || null,
        relatedHostIds,
        gatewayHostId: gatewayHostId || null,
        httpEndpoint: normalizedHttpEndpoint,
        groupId: copyFrom?.groupId ?? null
      }

      if (host) {
        await window.consoleri.hosts.update(host.id, input)
      } else {
        const savedHost = await window.consoleri.hosts.create(input)
        await applyPendingProfiles(pendingProfiles, savedHost.id)

        const sourceDefaultProfileId = copyFrom?.defaultProfileId
        if (sourceDefaultProfileId) {
          const linkedProfileIds = new Set(
            pendingProfiles.flatMap((p) => (p.kind === 'picked' ? [p.profile.id] : []))
          )
          if (linkedProfileIds.has(sourceDefaultProfileId)) {
            await window.consoleri.hosts.update(savedHost.id, {
              defaultProfileId: sourceDefaultProfileId
            })
          }
        }
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleDraftProfile = (input: ProfileInput): void => {
    setPendingProfiles((prev) => {
      if (
        input.cloneFromProfileId &&
        prev.some(
          (p) => p.kind === 'new' && p.input.cloneFromProfileId === input.cloneFromProfileId
        )
      ) {
        return prev
      }
      return [...prev, { key: newPendingKey(), kind: 'new', input }]
    })
    setShowAddProfile(false)
  }

  const handlePickProfile = (profiles: ConnectionProfile[]): void => {
    setPendingProfiles((prev) => mergePickedProfiles(prev, profiles))
    setShowPickDialog(false)
  }

  const excludeProfileIds = useMemo(
    () =>
      pendingProfiles.flatMap((p) => {
        if (p.kind === 'picked') return [p.profile.id]
        if (p.input.cloneFromProfileId) return [p.input.cloneFromProfileId]
        return []
      }),
    [pendingProfiles]
  )

  const removePending = (key: string): void => {
    setPendingProfiles((prev) => prev.filter((p) => p.key !== key))
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 p-4 text-sm">
        {!host && (
          <h3 className="text-base font-medium text-gray-200">
            {isCopyMode ? 'Copy host' : 'Add host'}
          </h3>
        )}
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
        <label className="block">
          <span className="text-gray-400">HTTP Endpoint</span>
          <input
            type="url"
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={httpEndpoint}
            onChange={(e) => {
              setHttpEndpoint(e.target.value)
              if (httpEndpointError) setHttpEndpointError(null)
            }}
            placeholder="https://alb.example/health"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Optional. For HTTP(S) traffic through ALB terminating on this host.
          </span>
          {httpEndpointError && (
            <span className="mt-1 block text-xs text-red-400">{httpEndpointError}</span>
          )}
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

        {(host || isCopyMode) && (
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
            <span className="mt-1 block text-xs text-gray-500">
              Controls terminal colors and shell prompt style. Edit the profile to change Shell prompt
              (Consoleri vs server).
            </span>
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
                  excludeProfileIds={excludeProfileIds}
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

        {(host || isCopyMode) && otherHosts.length > 0 && (
          <div className="block">
            <span className="text-gray-400">Related hosts</span>
            <div className="mt-1 max-h-28 overflow-y-auto rounded border border-[#30363d] bg-[#0d1117] p-2">
              {otherHosts.map((h) => (
                <label key={h.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={relatedHostIds.includes(h.id)}
                    onChange={(e) => {
                      setRelatedHostIds((prev) =>
                        e.target.checked ? [...prev, h.id] : prev.filter((id) => id !== h.id)
                      )
                    }}
                  />
                  <span className="truncate">{h.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {(host || isCopyMode) && (
          <label className="block">
            <span className="text-gray-400">Gateway host</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={gatewayHostId}
              onChange={(e) => setGatewayHostId(e.target.value)}
            >
              <option value="">None (direct)</option>
              {gatewayOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-gray-400">Notes</span>
          <textarea
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {host && profiles && onProfilesChanged && onConnect && (
          <HostProfilesSection
            host={host}
            profiles={profiles}
            onConnect={onConnect}
            onProfilesChanged={onProfilesChanged}
          />
        )}

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
          excludeProfileIds={excludeProfileIds}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePickProfile}
        />
      )}
    </>
  )
}
