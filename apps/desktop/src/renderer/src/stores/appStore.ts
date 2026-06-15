import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import {
  hostListViewToGroupFilter,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  type AppView,
  type HostListGroupBy,
  type HostListGroupFilter,
  type HostListSortBy,
  type HostListSortDir,
  type HostListViewSettings,
  type MapViewMode,
  type MapViewSettings
} from '@consoleri/core'
import type { Host, HostGroup, ConnectionProfile, SessionInfo, WorkspaceState, PaneBinding } from '@shared/types'

const SETTINGS_KEY = 'consoleri.settings'
const LAYOUT_SAVE_DEBOUNCE_MS = 300
const HOST_LIST_VIEW_SAVE_DEBOUNCE_MS = 300
const MAP_VIEW_SAVE_DEBOUNCE_MS = 300
let sidebarPersistTimer: ReturnType<typeof setTimeout> | null = null
let layoutSaveTimer: ReturnType<typeof setTimeout> | null = null
let hostListViewSaveTimer: ReturnType<typeof setTimeout> | null = null
let mapViewSaveTimer: ReturnType<typeof setTimeout> | null = null
let hostListViewReady = false
let mapViewReady = false

export type SessionOpenMode = 'workspace' | 'window'

interface AppSettings {
  autoOpenConnectionLog: boolean
  sessionOpenMode: SessionOpenMode
}

function loadSidebarWidth(): number {
  return 360
}

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

export type SidebarView = 'hosts' | 'keys' | 'profiles'

interface AppState {
  hosts: Host[]
  allHosts: Host[]
  allHostTags: string[]
  groups: HostGroup[]
  profiles: ConnectionProfile[]
  sessions: SessionInfo[]
  workspace: WorkspaceState
  hostListView: HostListViewSettings
  hostListViewLoaded: boolean
  mapView: MapViewSettings
  mapViewLoaded: boolean
  appView: AppView
  mapMode: MapViewMode
  selectedHostId: string | null
  search: string
  selectedTags: string[]
  selectedGroupId: HostListGroupFilter
  groupBy: HostListGroupBy
  collapsedSections: string[]
  sortBy: HostListSortBy
  sortDir: HostListSortDir
  sidebarWidth: number
  sidebarView: SidebarView
  settings: AppSettings
  setSearch: (s: string) => void
  setSelectedTags: (tags: string[]) => void
  setSelectedGroupId: (id: HostListGroupFilter) => void
  setGroupBy: (groupBy: HostListGroupBy) => void
  setSortBy: (sortBy: HostListSortBy) => void
  setSortDir: (sortDir: HostListSortDir) => void
  toggleCollapsedSection: (sectionId: string) => void
  setSelectedHostId: (id: string | null) => void
  setSidebarView: (view: SidebarView) => void
  setAppView: (view: AppView) => void
  setMapMode: (mode: MapViewMode) => void
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
  setSessionOpenMode: (mode: SessionOpenMode) => void
  loadHostListView: () => Promise<void>
  loadMapView: () => Promise<void>
  refreshHosts: () => Promise<void>
  refreshAllHosts: () => Promise<void>
  refreshAllHostTags: () => Promise<void>
  refreshGroups: () => Promise<void>
}

function syncHostListViewFields(view: HostListViewSettings): Pick<
  AppState,
  | 'hostListView'
  | 'selectedTags'
  | 'selectedGroupId'
  | 'selectedHostId'
  | 'groupBy'
  | 'collapsedSections'
  | 'sortBy'
  | 'sortDir'
> {
  return {
    hostListView: view,
    selectedTags: view.selectedTags,
    selectedGroupId: view.selectedGroupId,
    selectedHostId: view.selectedHostId,
    groupBy: view.groupBy,
    collapsedSections: view.collapsedSections,
    sortBy: view.sortBy,
    sortDir: view.sortDir
  }
}

function scheduleHostListViewPersist(get: () => AppState): void {
  if (!hostListViewReady) return
  if (hostListViewSaveTimer) clearTimeout(hostListViewSaveTimer)
  hostListViewSaveTimer = setTimeout(() => {
    hostListViewSaveTimer = null
    const { hostListView } = get()
    void window.consoleri.preferences.setHostListView(hostListView)
  }, HOST_LIST_VIEW_SAVE_DEBOUNCE_MS)
}

function updateHostListView(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  patch: Partial<HostListViewSettings>
): void {
  const nextView: HostListViewSettings = {
    ...get().hostListView,
    ...patch
  }
  set(syncHostListViewFields(nextView))
  scheduleHostListViewPersist(get)
}

function scheduleMapViewPersist(get: () => AppState): void {
  if (!mapViewReady) return
  if (mapViewSaveTimer) clearTimeout(mapViewSaveTimer)
  mapViewSaveTimer = setTimeout(() => {
    mapViewSaveTimer = null
    const { mapView } = get()
    void window.consoleri.preferences.setMapView(mapView)
  }, MAP_VIEW_SAVE_DEBOUNCE_MS)
}

function updateMapView(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  patch: Partial<MapViewSettings>
): void {
  const nextView: MapViewSettings = { ...get().mapView, ...patch }
  set({
    mapView: nextView,
    appView: nextView.appView,
    mapMode: nextView.mapMode
  })
  scheduleMapViewPersist(get)
}

export const useAppStore = create<AppState>((set, get) => ({
  hosts: [],
  allHosts: [],
  allHostTags: [],
  groups: [],
  profiles: [],
  sessions: [],
  workspace: { layout: null, panes: [] },
  hostListView: {
    version: 1,
    groupBy: 'none',
    selectedTags: [],
    selectedGroupId: 'all',
    selectedHostId: null,
    collapsedSections: [],
    sortBy: 'name',
    sortDir: 'asc'
  },
  hostListViewLoaded: false,
  mapView: {
    version: 1,
    appView: 'list',
    mapMode: 'logical'
  },
  mapViewLoaded: false,
  appView: 'list',
  mapMode: 'logical',
  selectedHostId: null,
  search: '',
  selectedTags: [],
  selectedGroupId: 'all',
  groupBy: 'none',
  collapsedSections: [],
  sortBy: 'name',
  sortDir: 'asc',
  sidebarWidth: loadSidebarWidth(),
  sidebarView: 'hosts',
  settings: loadSettings(),
  setSearch: (search) => set({ search }),
  setSelectedTags: (selectedTags) => {
    updateHostListView(get, set, { selectedTags })
  },
  setSelectedGroupId: (selectedGroupId) => {
    updateHostListView(get, set, { selectedGroupId })
  },
  setGroupBy: (groupBy) => {
    updateHostListView(get, set, { groupBy })
  },
  setSortBy: (sortBy) => {
    updateHostListView(get, set, { sortBy })
  },
  setSortDir: (sortDir) => {
    updateHostListView(get, set, { sortDir })
  },
  toggleCollapsedSection: (sectionId) => {
    const collapsed = get().collapsedSections
    const next = collapsed.includes(sectionId)
      ? collapsed.filter((id) => id !== sectionId)
      : [...collapsed, sectionId]
    updateHostListView(get, set, { collapsedSections: next })
  },
  setSelectedHostId: (selectedHostId) => {
    updateHostListView(get, set, { selectedHostId })
  },
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setAppView: (appView) => {
    updateMapView(get, set, { appView })
  },
  setMapMode: (mapMode) => {
    updateMapView(get, set, { mapMode })
  },
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
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
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
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
    set({ sidebarWidth: clamped })
  },
  setAutoOpenConnectionLog: (autoOpenConnectionLog) => {
    const settings = { ...get().settings, autoOpenConnectionLog }
    persistSettings(settings)
    set({ settings })
  },
  setSessionOpenMode: (sessionOpenMode) => {
    const settings = { ...get().settings, sessionOpenMode }
    persistSettings(settings)
    set({ settings })
  },
  loadHostListView: async () => {
    const view = await window.consoleri.preferences.getHostListView()
    hostListViewReady = true
    set({
      ...syncHostListViewFields(view),
      hostListViewLoaded: true
    })
  },
  loadMapView: async () => {
    const view = await window.consoleri.preferences.getMapView()
    mapViewReady = true
    set({
      mapView: view,
      appView: view.appView,
      mapMode: view.mapMode,
      mapViewLoaded: true
    })
  },
  refreshHosts: async () => {
    const { search, selectedTags, selectedGroupId } = get()
    const groupId = hostListViewToGroupFilter(selectedGroupId)
    const hosts = await window.consoleri.hosts.list({
      search: search || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      ...(groupId !== undefined ? { groupId } : {})
    })

    let { selectedHostId } = get()
    if (selectedHostId && !hosts.some((host) => host.id === selectedHostId)) {
      selectedHostId = null
      updateHostListView(get, set, { selectedHostId: null })
    }

    set({ hosts })
  },
  refreshAllHostTags: async () => {
    const allHosts = await window.consoleri.hosts.list()
    const tagSet = new Set<string>()
    allHosts.forEach((host) => host.tags.forEach((tag) => tagSet.add(tag)))
    set({ allHostTags: Array.from(tagSet).sort(), allHosts })
  },
  refreshAllHosts: async () => {
    const allHosts = await window.consoleri.hosts.list()
    set({ allHosts })
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
