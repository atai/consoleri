import type { BrowserWindow } from 'electron'
import { APP_NAME } from './appName'
import { hostRepository } from './hosts/HostRepository'
import { profileRepository } from './hosts/ProfileRepository'
import type { SessionInfo } from '../shared/types'

export const WINDOW_TITLE_SEP = ' - '

export function joinWindowTitle(...parts: string[]): string {
  return parts.filter((p) => p.length > 0).join(WINDOW_TITLE_SEP)
}

/** Keep BrowserWindow.title from main process; re-apply after HTML `<title>` loads. */
export function pinBrowserWindowTitle(win: BrowserWindow, getTitle: () => string): void {
  const apply = (): void => {
    if (win.isDestroyed()) return
    win.setTitle(getTitle())
  }

  apply()
  win.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    apply()
  })
  win.webContents.on('did-finish-load', apply)
}

function hostProfileParts(hostId?: string | null, profileId?: string | null): string[] {
  const host = hostId ? hostRepository.getHost(hostId) : null
  const profile = profileId ? profileRepository.getProfile(profileId) : null
  if (host && profile) return [host.name, profile.name]
  if (host) return [host.name]
  return []
}

export function formatSessionWindowTitle(session: SessionInfo): string {
  const parts = hostProfileParts(session.hostId, session.profileId)
  if (parts.length === 0) parts.push(session.title)
  return joinWindowTitle(...parts, APP_NAME)
}

export function formatReportWindowTitle(reportName: string): string {
  return joinWindowTitle(reportName, 'Report', APP_NAME)
}

export type LogWindowKind = 'connection' | 'deploy'

export function formatLogWindowTitle(options: {
  kind: LogWindowKind
  hostId?: string | null
  profileId?: string | null
  fallbackLabel?: string
}): string {
  const kindLabel = options.kind === 'deploy' ? 'Deploy log' : 'Connection log'
  const parts = hostProfileParts(options.hostId, options.profileId)
  if (parts.length === 0 && options.fallbackLabel) parts.push(options.fallbackLabel)
  return joinWindowTitle(...parts, kindLabel, APP_NAME)
}
