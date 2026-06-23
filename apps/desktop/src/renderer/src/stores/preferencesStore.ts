import { create } from 'zustand'

export type SessionOpenMode = 'workspace' | 'window'

interface AppSettings {
  autoOpenConnectionLog: boolean
  sessionOpenMode: SessionOpenMode
}

const SETTINGS_KEY = 'consoleri.settings'

function normalizeSessionOpenMode(value: unknown): SessionOpenMode {
  return value === 'window' ? 'window' : 'workspace'
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        autoOpenConnectionLog: parsed.autoOpenConnectionLog ?? false,
        sessionOpenMode: normalizeSessionOpenMode(parsed.sessionOpenMode)
      }
    }
  } catch {
    /* ignore */
  }
  return { autoOpenConnectionLog: false, sessionOpenMode: 'workspace' }
}

function persistSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

interface PreferencesState {
  settings: AppSettings
  setAutoOpenConnectionLog: (value: boolean) => void
  setSessionOpenMode: (mode: SessionOpenMode) => void
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  settings: loadSettings(),
  setAutoOpenConnectionLog: (autoOpenConnectionLog) => {
    const settings = { ...get().settings, autoOpenConnectionLog }
    persistSettings(settings)
    set({ settings })
  },
  setSessionOpenMode: (sessionOpenMode) => {
    const settings = { ...get().settings, sessionOpenMode }
    persistSettings(settings)
    set({ settings })
  }
}))
