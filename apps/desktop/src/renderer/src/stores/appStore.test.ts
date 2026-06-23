import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── window.consoleri stub ─────────────────────────────────────────────────────
const mockPreferencesSetHostListView = vi.fn().mockResolvedValue(undefined)
const mockPreferencesSetMapView = vi.fn().mockResolvedValue(undefined)
const mockPreferencesGetHostListView = vi.fn()
const mockPreferencesGetMapView = vi.fn()
const mockPreferencesGetAppSettings = vi.fn().mockResolvedValue({ autoOpenConnectionLog: false, sessionOpenMode: 'workspace' })
const mockPreferencesSetAppSettings = vi.fn().mockImplementation((patch: Record<string, unknown>) =>
  Promise.resolve({ autoOpenConnectionLog: false, sessionOpenMode: 'workspace', ...patch })
)
const mockWorkspaceSave = vi.fn().mockResolvedValue(undefined)
const mockHostsList = vi.fn().mockResolvedValue([])
const mockGroupsList = vi.fn().mockResolvedValue([])
const mockUxProfilesGetActive = vi.fn()
const mockUxProfilesUpdate = vi.fn().mockResolvedValue(undefined)

function installConsoleriGlobal() {
  Object.defineProperty(window, 'consoleri', {
    value: {
      preferences: {
        setHostListView: mockPreferencesSetHostListView,
        setMapView: mockPreferencesSetMapView,
        getHostListView: mockPreferencesGetHostListView,
        getMapView: mockPreferencesGetMapView,
        getAppSettings: mockPreferencesGetAppSettings,
        setAppSettings: mockPreferencesSetAppSettings
      },
      workspace: {
        save: mockWorkspaceSave
      },
      hosts: {
        list: mockHostsList
      },
      groups: {
        list: mockGroupsList
      },
      uxProfiles: {
        getActive: mockUxProfilesGetActive,
        update: mockUxProfilesUpdate
      }
    },
    writable: true,
    configurable: true
  })
}

// ── localStorage stub ─────────────────────────────────────────────────────────
const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear())
}

beforeEach(() => {
  vi.useFakeTimers()
  storage.clear()
  vi.clearAllMocks()
  installConsoleriGlobal()
  vi.stubGlobal('localStorage', mockLocalStorage)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── Fresh store helpers ───────────────────────────────────────────────────────
async function freshAppStore() {
  vi.resetModules()
  const mod = await import('./appStore')
  return mod
}

async function freshSessionWorkspaceStore() {
  vi.resetModules()
  const mod = await import('./sessionWorkspaceStore')
  return mod
}

async function freshPreferencesStore() {
  vi.resetModules()
  const mod = await import('./preferencesStore')
  return mod
}

// ── syncHostListViewFields: denormalized state ───────────────────────────────
describe('syncHostListViewFields denormalization', () => {
  it('setSelectedTags syncs selectedTags from hostListView', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().setSelectedTags(['web', 'prod'])
    const state = useAppStore.getState()
    expect(state.selectedTags).toEqual(['web', 'prod'])
    expect(state.hostListView.selectedTags).toEqual(['web', 'prod'])
  })

  it('setSelectedGroupId syncs selectedGroupId from hostListView', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().setSelectedGroupId('group-1')
    const state = useAppStore.getState()
    expect(state.selectedGroupId).toBe('group-1')
    expect(state.hostListView.selectedGroupId).toBe('group-1')
  })

  it('setGroupBy syncs groupBy from hostListView', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().setGroupBy('tag')
    const state = useAppStore.getState()
    expect(state.groupBy).toBe('tag')
    expect(state.hostListView.groupBy).toBe('tag')
  })

  it('setSortBy/setSortDir sync via hostListView', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().setSortBy('name')
    useAppStore.getState().setSortDir('desc')
    const state = useAppStore.getState()
    expect(state.sortBy).toBe('name')
    expect(state.sortDir).toBe('desc')
    expect(state.hostListView.sortBy).toBe('name')
    expect(state.hostListView.sortDir).toBe('desc')
  })

  it('toggleCollapsedSection adds and then removes a section', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().toggleCollapsedSection('sec-1')
    expect(useAppStore.getState().collapsedSections).toContain('sec-1')
    useAppStore.getState().toggleCollapsedSection('sec-1')
    expect(useAppStore.getState().collapsedSections).not.toContain('sec-1')
  })

  it('setSelectedHostId syncs selectedHostId', async () => {
    const { useAppStore } = await freshAppStore()
    useAppStore.getState().setSelectedHostId('host-42')
    expect(useAppStore.getState().selectedHostId).toBe('host-42')
    expect(useAppStore.getState().hostListView.selectedHostId).toBe('host-42')
  })
})

// ── hostListView debounced persistence ───────────────────────────────────────
describe('hostListView debounced persistence', () => {
  it('does NOT call setHostListView immediately on mutation', async () => {
    const { useAppStore } = await freshAppStore()
    mockPreferencesGetHostListView.mockResolvedValue({
      version: 1,
      groupBy: 'none',
      selectedTags: [],
      selectedGroupId: 'all',
      selectedHostId: null,
      collapsedSections: [],
      sortBy: 'name',
      sortDir: 'asc'
    })
    await useAppStore.getState().loadHostListView()
    mockPreferencesSetHostListView.mockClear()

    useAppStore.getState().setSelectedTags(['db'])
    expect(mockPreferencesSetHostListView).not.toHaveBeenCalled()
  })

  it('calls setHostListView after debounce delay', async () => {
    const { useAppStore } = await freshAppStore()
    mockPreferencesGetHostListView.mockResolvedValue({
      version: 1,
      groupBy: 'none',
      selectedTags: [],
      selectedGroupId: 'all',
      selectedHostId: null,
      collapsedSections: [],
      sortBy: 'name',
      sortDir: 'asc'
    })
    await useAppStore.getState().loadHostListView()
    mockPreferencesSetHostListView.mockClear()

    useAppStore.getState().setSelectedTags(['db'])
    vi.runAllTimers()
    expect(mockPreferencesSetHostListView).toHaveBeenCalledOnce()
  })
})

// ── persistWorkspace: debounce vs immediate ──────────────────────────────────
describe('persistWorkspace', () => {
  it('calls workspace.save immediately when debounce is false', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    useSessionWorkspaceStore.getState().persistWorkspace(null, [])
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })

  it('defers workspace.save when debounce is true', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    useSessionWorkspaceStore.getState().persistWorkspace(null, [], { debounce: true })
    expect(mockWorkspaceSave).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })

  it('updates workspace state synchronously even with debounce', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    const panes = [
      {
        paneId: 'p1',
        sessionId: null,
        protocol: 'ssh' as const,
        title: 'test',
        connectRequest: {}
      }
    ]
    useSessionWorkspaceStore.getState().persistWorkspace(null, panes, { debounce: true })
    expect(useSessionWorkspaceStore.getState().workspace.panes).toHaveLength(1)
  })
})

// ── flushWorkspacePersist ─────────────────────────────────────────────────────
describe('flushWorkspacePersist', () => {
  it('flushes any pending debounced save immediately', async () => {
    const { useSessionWorkspaceStore, flushWorkspacePersist } = await freshSessionWorkspaceStore()
    useSessionWorkspaceStore.getState().persistWorkspace(null, [], { debounce: true })
    expect(mockWorkspaceSave).not.toHaveBeenCalled()
    flushWorkspacePersist()
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })
})

// ── settings: load / persist via IPC ─────────────────────────────────────────
describe('settings load/persist', () => {
  it('has default settings before refresh', async () => {
    const { usePreferencesStore } = await freshPreferencesStore()
    const { settings } = usePreferencesStore.getState()
    expect(settings.autoOpenConnectionLog).toBe(false)
    expect(settings.sessionOpenMode).toBe('workspace')
  })

  it('refresh loads settings from IPC', async () => {
    mockPreferencesGetAppSettings.mockResolvedValueOnce({ autoOpenConnectionLog: true, sessionOpenMode: 'window' })
    const { usePreferencesStore } = await freshPreferencesStore()
    await usePreferencesStore.getState().refresh()
    expect(usePreferencesStore.getState().settings.autoOpenConnectionLog).toBe(true)
    expect(usePreferencesStore.getState().settings.sessionOpenMode).toBe('window')
  })

  it('setAutoOpenConnectionLog calls setAppSettings IPC', async () => {
    const { usePreferencesStore } = await freshPreferencesStore()
    await usePreferencesStore.getState().setAutoOpenConnectionLog(true)
    expect(mockPreferencesSetAppSettings).toHaveBeenCalledWith({ autoOpenConnectionLog: true })
  })

  it('setSessionOpenMode calls setAppSettings IPC', async () => {
    const { usePreferencesStore } = await freshPreferencesStore()
    await usePreferencesStore.getState().setSessionOpenMode('window')
    expect(mockPreferencesSetAppSettings).toHaveBeenCalledWith({ sessionOpenMode: 'window' })
  })

  it('refresh migrates legacy localStorage key and removes it', async () => {
    storage.set('consoleri.settings', JSON.stringify({ autoOpenConnectionLog: true, sessionOpenMode: 'workspace' }))
    const { usePreferencesStore } = await freshPreferencesStore()
    await usePreferencesStore.getState().refresh()
    expect(mockPreferencesSetAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoOpenConnectionLog: true })
    )
    expect(storage.has('consoleri.settings')).toBe(false)
  })
})

// ── sessions state ────────────────────────────────────────────────────────────
describe('sessions state management', () => {
  it('addSession appends to sessions array', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connected' as const, hostId: null, profileId: null }
    useSessionWorkspaceStore.getState().addSession(session)
    expect(useSessionWorkspaceStore.getState().sessions).toHaveLength(1)
  })

  it('updateSession patches a session by id', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connecting' as const, hostId: null, profileId: null }
    useSessionWorkspaceStore.getState().addSession(session)
    useSessionWorkspaceStore.getState().updateSession('s1', { status: 'connected' })
    expect(useSessionWorkspaceStore.getState().sessions[0].status).toBe('connected')
  })

  it('removeSession removes a session by id', async () => {
    const { useSessionWorkspaceStore } = await freshSessionWorkspaceStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connected' as const, hostId: null, profileId: null }
    useSessionWorkspaceStore.getState().addSession(session)
    useSessionWorkspaceStore.getState().removeSession('s1')
    expect(useSessionWorkspaceStore.getState().sessions).toHaveLength(0)
  })
})

// ── mapView sync ──────────────────────────────────────────────────────────────
describe('mapView state sync', () => {
  it('setAppView updates both appView and mapView.appView', async () => {
    const { useAppStore } = await freshAppStore()
    mockPreferencesGetMapView.mockResolvedValue({ version: 1, appView: 'list', mapMode: 'logical' })
    await useAppStore.getState().loadMapView()

    useAppStore.getState().setAppView('map')
    const state = useAppStore.getState()
    expect(state.appView).toBe('map')
    expect(state.mapView.appView).toBe('map')
  })
})
