import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import type { Host, HostGroup, ConnectionProfile, SessionInfo, WorkspaceState, PaneBinding } from '@shared/types'

const SETTINGS_KEY = 'consoleri.settings'
const LAYOUT_SAVE_DEBOUNCE_MS = 300
let sidebarPersistTimer: ReturnType<typeof setTimeout> | null = null

let layoutSaveTimer: ReturnType<typeof setTimeout> | null = null

interface AppSettings {
  autoOpenConnectionLog: boolean
}

function loadSidebarWidth(): number {
  return 280
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return { autoOpenConnectionLog: parsed.autoOpenConnectionLog ?? false }
    }
  } catch {
    /* ignore */
  }
  return { autoOpenConnectionLog: false }
}

export type SidebarView = 'hosts' | 'keys' | 'profiles' | 'appearance'

interface AppState {
  hosts: Host[]
  groups: HostGroup[]
  profiles: ConnectionProfile[]
  sessions: SessionInfo[]
  workspace: WorkspaceState
  selectedHostId: string | null
  search: string
  selectedTags: string[]
  selectedGroupId: string | null
  sidebarWidth: number
  sidebarView: SidebarView
  settings: AppSettings
  setSearch: (s: string) => void
  setSelectedTags: (tags: string[]) => void
  setSelectedGroupId: (id: string | null) => void
  setSelectedHostId: (id: string | null) => void
  setSidebarView: (view: SidebarView) => void
  setHosts: (hosts: Host[]) => void
  setGroups: (groups: HostGroup[]) => void
  setProfiles: (profiles: ConnectionProfile[]) => void
  addSession: (session: SessionInfo) => void
  updateSession: (id: string, patch: Partial<SessionInfo>) => void
  removeSession: (id: string) => void
  setWorkspace: (ws: WorkspaceState) => void
  persistWorkspace: (layout: MosaicNode<string> | null, panes: PaneBinding[], options?: { debounce?: boolean }) => void
  setSidebarWidth: (width: number) => void
  setSidebarWidthFromProfile: (width: number) => void
  setAutoOpenConnectionLog: (value: boolean) => void
  refreshHosts: () => Promise<void>
  refreshGroups: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  hosts: [],
  groups: [],
  profiles: [],
  sessions: [],
  workspace: { layout: null, panes: [] },
  selectedHostId: null,
  search: '',
  selectedTags: [],
  selectedGroupId: null,
  sidebarWidth: loadSidebarWidth(),
  sidebarView: 'hosts',
  settings: loadSettings(),
  setSearch: (search) => set({ search }),
  setSelectedTags: (selectedTags) => set({ selectedTags }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
  setSelectedHostId: (selectedHostId) => set({ selectedHostId }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setHosts: (hosts) => set({ hosts }),
  setGroups: (groups) => set({ groups }),
  setProfiles: (profiles) => set({ profiles }),
  addSession: (session) => set({ sessions: [...get().sessions, session] }),
  updateSession: (id, patch) =>
    set({
      sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...patch } : s))
    }),
  removeSession: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
  setWorkspace: (workspace) => set({ workspace }),
  persistWorkspace: (layout, panes, options) => {
    const state: WorkspaceState = { layout, panes }
    set({ workspace: state })
    if (options?.debounce) {
      if (layoutSaveTimer) clearTimeout(layoutSaveTimer)
      layoutSaveTimer = setTimeout(() => {
        layoutSaveTimer = null
        void window.consoleri.workspace.save(state)
      }, LAYOUT_SAVE_DEBOUNCE_MS)
      return
    }
    if (layoutSaveTimer) {
      clearTimeout(layoutSaveTimer)
      layoutSaveTimer = null
    }
    void window.consoleri.workspace.save(state)
  },
  setSidebarWidth: (width) => {
    const clamped = Math.min(480, Math.max(200, width))
    set({ sidebarWidth: clamped })
    if (sidebarPersistTimer) clearTimeout(sidebarPersistTimer)
    sidebarPersistTimer = setTimeout(() => {
      sidebarPersistTimer = null
      void window.consoleri.uxProfiles.getActive().then((profile) =>
        window.consoleri.uxProfiles.update(profile.id, {
          chrome: { ...profile.chrome, sidebarWidth: clamped }
        })
      )
    }, 300)
  },
  setSidebarWidthFromProfile: (width) => {
    const clamped = Math.min(480, Math.max(200, width))
    set({ sidebarWidth: clamped })
  },
  setAutoOpenConnectionLog: (autoOpenConnectionLog) => {
    const settings = { ...get().settings, autoOpenConnectionLog }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    set({ settings })
  },
  refreshHosts: async () => {
    const { search, selectedTags, selectedGroupId } = get()
    const hosts = await window.consoleri.hosts.list({
      search: search || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      groupId: selectedGroupId
    })
    set({ hosts })
  },
  refreshGroups: async () => {
    const groups = await window.consoleri.groups.list()
    set({ groups })
  }
}))

export function flushWorkspacePersist(): void {
  if (layoutSaveTimer) {
    clearTimeout(layoutSaveTimer)
    layoutSaveTimer = null
  }
  const { workspace } = useAppStore.getState()
  void window.consoleri.workspace.save(workspace)
}
