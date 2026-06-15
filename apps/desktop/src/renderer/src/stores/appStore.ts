import { create } from 'zustand'
import type { Host, HostGroup, ConnectionProfile, SessionInfo, WorkspaceState } from '@shared/types'

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
  setSearch: (s: string) => void
  setSelectedTags: (tags: string[]) => void
  setSelectedGroupId: (id: string | null) => void
  setSelectedHostId: (id: string | null) => void
  setHosts: (hosts: Host[]) => void
  setGroups: (groups: HostGroup[]) => void
  setProfiles: (profiles: ConnectionProfile[]) => void
  addSession: (session: SessionInfo) => void
  updateSession: (id: string, patch: Partial<SessionInfo>) => void
  removeSession: (id: string) => void
  setWorkspace: (ws: WorkspaceState) => void
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
  sidebarWidth: 280,
  setSearch: (search) => set({ search }),
  setSelectedTags: (selectedTags) => set({ selectedTags }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
  setSelectedHostId: (selectedHostId) => set({ selectedHostId }),
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
