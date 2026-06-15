import type { Host, OpenSessionRequest } from '@shared/types'
import { useAppStore } from '../stores/appStore'
import { openSession, openSessionAndAddToWorkspace } from './openSession'

export async function resolveHostConnectRequest(
  host: Host,
  profileId?: string
): Promise<OpenSessionRequest> {
  const hostProfiles = await window.consoleri.profiles.list(host.id)
  const profile = profileId
    ? hostProfiles.find((p) => p.id === profileId)
    : host.defaultProfileId
      ? hostProfiles.find((p) => p.id === host.defaultProfileId)
      : hostProfiles[0]
  return {
    hostId: host.id,
    profileId: profile?.id
  }
}

export async function connectHost(host: Host, profileId?: string): Promise<void> {
  const request = await resolveHostConnectRequest(host, profileId)
  await openSessionAndAddToWorkspace(request)
}

export async function connectHostInWindow(host: Host, profileId?: string): Promise<void> {
  const request = await resolveHostConnectRequest(host, profileId)
  const session = await openSession(request)
  if (!session) return
  await window.consoleri.sessions.openSessionWindow(session.id)
}

export async function connectFromList(host: Host, profileId?: string): Promise<void> {
  const mode = useAppStore.getState().settings.sessionOpenMode
  if (mode === 'window') return connectHostInWindow(host, profileId)
  return connectHost(host, profileId)
}

export async function openLocalSessionFromList(request: OpenSessionRequest): Promise<void> {
  const mode = useAppStore.getState().settings.sessionOpenMode
  if (mode === 'window') {
    const session = await openSession(request)
    if (session) await window.consoleri.sessions.openSessionWindow(session.id)
    return
  }
  await openSessionAndAddToWorkspace(request)
}
