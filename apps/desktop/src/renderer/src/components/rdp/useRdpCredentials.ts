import { useEffect, useState } from 'react'

export interface RdpCredentials {
  username: string
  password: string
}

/**
 * Fetches RDP credentials for the given profile. Returns `null` while the
 * async request is in flight; resolves to `{ username: '', password: '' }`
 * when no profileId is provided or the profile has no stored credentials.
 */
export function useRdpCredentials(
  effectiveProfileId: string | null | undefined
): RdpCredentials | null {
  const [credentials, setCredentials] = useState<RdpCredentials | null>(null)

  useEffect(() => {
    if (!effectiveProfileId) {
      setCredentials({ username: '', password: '' })
      return
    }

    let cancelled = false
    void window.consoleri.sessions.getRdpCredentials(effectiveProfileId).then((creds) => {
      if (!cancelled) {
        setCredentials(creds ?? { username: '', password: '' })
      }
    })

    return () => {
      cancelled = true
    }
  }, [effectiveProfileId])

  return credentials
}
