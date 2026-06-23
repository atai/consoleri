import { create } from 'zustand'
import type { AppSettings, SessionOpenMode } from '@shared/types'

export type { SessionOpenMode }

const LEGACY_SETTINGS_KEY = 'consoleri.settings'

const DEFAULT_SETTINGS: AppSettings = {
  autoOpenConnectionLog: false,
  sessionOpenMode: 'workspace'
}

interface PreferencesState {
  settings: AppSettings
  loaded: boolean
  refresh: () => Promise<void>
  setAutoOpenConnectionLog: (value: boolean) => Promise<void>
  setSessionOpenMode: (mode: SessionOpenMode) => Promise<void>
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  refresh: async () => {
    // One-time migration: if the old localStorage key exists, push its values
    // to the DB and remove the key so this branch never runs again.
    try {
      const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<AppSettings>
        await window.consoleri.preferences.setAppSettings(parsed)
        localStorage.removeItem(LEGACY_SETTINGS_KEY)
      }
    } catch {
      /* ignore migration errors */
    }

    const settings = await window.consoleri.preferences.getAppSettings()
    set({ settings, loaded: true })
  },

  setAutoOpenConnectionLog: async (autoOpenConnectionLog) => {
    const settings = await window.consoleri.preferences.setAppSettings({ autoOpenConnectionLog })
    set({ settings })
  },

  setSessionOpenMode: async (sessionOpenMode) => {
    const settings = await window.consoleri.preferences.setAppSettings({ sessionOpenMode })
    set({ settings })
  }
}))
