import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'

export interface HostConnectControlProps {
  host: Host
  onConnect: (host: Host, profileId?: string) => void
  className?: string
}

function defaultProfileId(host: Host, profiles: ConnectionProfile[]): string {
  if (host.defaultProfileId && profiles.some((p) => p.id === host.defaultProfileId)) {
    return host.defaultProfileId
  }
  return profiles[0]?.id ?? ''
}

export function HostConnectControl({
  host,
  onConnect,
  className = ''
}: HostConnectControlProps): React.JSX.Element {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.consoleri.profiles.list(host.id).then((list) => {
      if (cancelled) return
      setProfiles(list)
      setSelectedProfileId(defaultProfileId(host, list))
    })
    return () => {
      cancelled = true
    }
  }, [host.id, host.defaultProfileId])

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        id: profile.id,
        label: `${profile.name} (${profile.protocol})`
      })),
    [profiles]
  )

  const handleConnect = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (profiles.length > 1) {
      onConnect(host, selectedProfileId || undefined)
      return
    }
    onConnect(host, profiles[0]?.id)
  }

  return (
    <div className={`mt-2 space-y-1.5 ${className}`}>
      {profiles.length > 1 && (
        <select
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-1 text-[10px] text-gray-200"
          value={selectedProfileId}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            setSelectedProfileId(e.target.value)
          }}
        >
          {profileOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={handleConnect}
        className="w-full rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-500"
      >
        Connect
      </button>
    </div>
  )
}
