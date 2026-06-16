import { create } from 'zustand'
import { resolveUxProfile } from '@consoleri/core'
import type { TerminalAppearance, UxProfile } from '@consoleri/core'
import { applyAppearanceToAll } from '../terminal/TerminalPool'
import { useAppStore } from './appStore'

const LEGACY_SIDEBAR_WIDTH_KEY = 'consoleri.sidebarWidth'

interface UxProfileState {
  profiles: UxProfile[]
  activeId: string | null
  loaded: boolean
  refresh: () => Promise<void>
  resolveForHost: (hostId: string | null | undefined) => UxProfile
  resolveTerminalForHost: (hostId: string | null | undefined) => TerminalAppearance
  setActive: (id: string) => Promise<void>
  applyActiveChrome: () => void
  applyProfilesToOpenTerminals: () => void
}

function applyProfilesToOpenTerminals(): void {
  const { sessions } = useAppStore.getState()
  const resolveTerminalForHost = useUxProfileStore.getState().resolveTerminalForHost
  applyAppearanceToAll(sessions, resolveTerminalForHost)
}

export const useUxProfileStore = create<UxProfileState>((set, get) => ({
  profiles: [],
  activeId: null,
  loaded: false,
  refresh: async () => {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_SIDEBAR_WIDTH_KEY)
      if (legacyRaw) {
        const legacyWidth = Number(legacyRaw)
        if (Number.isFinite(legacyWidth)) {
          await window.consoleri.uxProfiles.migrateSidebarWidth(legacyWidth)
        }
        localStorage.removeItem(LEGACY_SIDEBAR_WIDTH_KEY)
      }
    } catch {
      /* ignore legacy migration errors */
    }

    const [profiles, active] = await Promise.all([
      window.consoleri.uxProfiles.list(),
      window.consoleri.uxProfiles.getActive()
    ])
    set({ profiles, activeId: active.id, loaded: true })
    get().applyActiveChrome()
    get().applyProfilesToOpenTerminals()
  },
  resolveForHost: (hostId) => {
    const { profiles, activeId } = get()
    const host = hostId ? useAppStore.getState().hosts.find((h) => h.id === hostId) : undefined
    return resolveUxProfile(profiles, {
      hostUxProfileId: host?.uxProfileId,
      activeUxProfileId: activeId
    })
  },
  resolveTerminalForHost: (hostId) => get().resolveForHost(hostId).terminal,
  setActive: async (id) => {
    const profile = await window.consoleri.uxProfiles.setActive(id)
    set({ activeId: profile.id })
    get().applyActiveChrome()
    get().applyProfilesToOpenTerminals()
  },
  applyActiveChrome: () => {
    const { profiles, activeId } = get()
    const active = resolveUxProfile(profiles, { activeUxProfileId: activeId })
    useAppStore.getState().setSidebarWidthFromProfile(active.chrome.sidebarWidth)
  },
  applyProfilesToOpenTerminals
}))
