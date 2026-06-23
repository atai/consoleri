import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── window.consoleri stub ─────────────────────────────────────────────────────
const mockPreferencesSetHostListView = vi.fn().mockResolvedValue(undefined)
const mockPreferencesSetMapView = vi.fn().mockResolvedValue(undefined)
const mockPreferencesGetHostListView = vi.fn()
const mockPreferencesGetMapView = vi.fn()
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
        getMapView: mockPreferencesGetMapView
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

// ── Import store AFTER globals are set up ─────────────────────────────────────
// We import dynamically per test to get a fresh Zustand store state.
// The store module is reset via vi.resetModules().
async function freshStore() {
  vi.resetModules()
  const mod = await import('./appStore')
  return mod
}

// ── syncHostListViewFields: denormalized state ───────────────────────────────
describe('syncHostListViewFields denormalization', () => {
  it('setSelectedTags syncs selectedTags from hostListView', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setSelectedTags(['web', 'prod'])
    const state = useAppStore.getState()
    expect(state.selectedTags).toEqual(['web', 'prod'])
    expect(state.hostListView.selectedTags).toEqual(['web', 'prod'])
  })

  it('setSelectedGroupId syncs selectedGroupId from hostListView', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setSelectedGroupId('group-1')
    const state = useAppStore.getState()
    expect(state.selectedGroupId).toBe('group-1')
    expect(state.hostListView.selectedGroupId).toBe('group-1')
  })

  it('setGroupBy syncs groupBy from hostListView', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setGroupBy('group')
    const state = useAppStore.getState()
    expect(state.groupBy).toBe('group')
    expect(state.hostListView.groupBy).toBe('group')
  })

  it('setSortBy/setSortDir sync via hostListView', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setSortBy('name')
    useAppStore.getState().setSortDir('desc')
    const state = useAppStore.getState()
    expect(state.sortBy).toBe('name')
    expect(state.sortDir).toBe('desc')
    expect(state.hostListView.sortBy).toBe('name')
    expect(state.hostListView.sortDir).toBe('desc')
  })

  it('toggleCollapsedSection adds and then removes a section', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().toggleCollapsedSection('sec-1')
    expect(useAppStore.getState().collapsedSections).toContain('sec-1')
    useAppStore.getState().toggleCollapsedSection('sec-1')
    expect(useAppStore.getState().collapsedSections).not.toContain('sec-1')
  })

  it('setSelectedHostId syncs selectedHostId', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setSelectedHostId('host-42')
    expect(useAppStore.getState().selectedHostId).toBe('host-42')
    expect(useAppStore.getState().hostListView.selectedHostId).toBe('host-42')
  })
})

// ── hostListView debounced persistence ───────────────────────────────────────
describe('hostListView debounced persistence', () => {
  it('does NOT call setHostListView immediately on mutation', async () => {
    const { useAppStore } = await freshStore()
    // loadHostListView must have been called first to set hostListViewReady=true
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
    const { useAppStore } = await freshStore()
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
    const { useAppStore } = await freshStore()
    useAppStore.getState().persistWorkspace(null, [])
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })

  it('defers workspace.save when debounce is true', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().persistWorkspace(null, [], { debounce: true })
    expect(mockWorkspaceSave).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })

  it('updates workspace state synchronously even with debounce', async () => {
    const { useAppStore } = await freshStore()
    const panes = [
      {
        paneId: 'p1',
        sessionId: null,
        protocol: 'ssh' as const,
        title: 'test',
        connectRequest: {}
      }
    ]
    useAppStore.getState().persistWorkspace(null, panes, { debounce: true })
    expect(useAppStore.getState().workspace.panes).toHaveLength(1)
  })
})

// ── flushWorkspacePersist ─────────────────────────────────────────────────────
describe('flushWorkspacePersist', () => {
  it('flushes any pending debounced save immediately', async () => {
    const { useAppStore, flushWorkspacePersist } = await freshStore()
    useAppStore.getState().persistWorkspace(null, [], { debounce: true })
    expect(mockWorkspaceSave).not.toHaveBeenCalled()
    flushWorkspacePersist()
    expect(mockWorkspaceSave).toHaveBeenCalledOnce()
  })
})

// ── settings: load / persist ──────────────────────────────────────────────────
describe('settings load/persist', () => {
  it('loads defaults when localStorage is empty', async () => {
    const { useAppStore } = await freshStore()
    const { settings } = useAppStore.getState()
    expect(settings.autoOpenConnectionLog).toBe(false)
    expect(settings.sessionOpenMode).toBe('workspace')
  })

  it('persists settings to localStorage when changed', async () => {
    const { useAppStore } = await freshStore()
    useAppStore.getState().setAutoOpenConnectionLog(true)
    expect(mockLocalStorage.setItem).toHaveBeenCalled()
    const raw = mockLocalStorage.setItem.mock.calls.at(-1)?.[1] as string
    expect(JSON.parse(raw).autoOpenConnectionLog).toBe(true)
  })

  it('reads persisted autoOpenConnectionLog from localStorage on load', async () => {
    storage.set('consoleri.settings', JSON.stringify({ autoOpenConnectionLog: true, sessionOpenMode: 'workspace' }))
    const { useAppStore } = await freshStore()
    expect(useAppStore.getState().settings.autoOpenConnectionLog).toBe(true)
  })

  it('normalizes unknown sessionOpenMode to workspace', async () => {
    storage.set('consoleri.settings', JSON.stringify({ sessionOpenMode: 'invalid' }))
    const { useAppStore } = await freshStore()
    expect(useAppStore.getState().settings.sessionOpenMode).toBe('workspace')
  })

  it('accepts window sessionOpenMode value', async () => {
    storage.set('consoleri.settings', JSON.stringify({ sessionOpenMode: 'window' }))
    const { useAppStore } = await freshStore()
    expect(useAppStore.getState().settings.sessionOpenMode).toBe('window')
  })
})

// ── sessions state ────────────────────────────────────────────────────────────
describe('sessions state management', () => {
  it('addSession appends to sessions array', async () => {
    const { useAppStore } = await freshStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connected' as const, hostId: null, profileId: null }
    useAppStore.getState().addSession(session)
    expect(useAppStore.getState().sessions).toHaveLength(1)
  })

  it('updateSession patches a session by id', async () => {
    const { useAppStore } = await freshStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connecting' as const, hostId: null, profileId: null }
    useAppStore.getState().addSession(session)
    useAppStore.getState().updateSession('s1', { status: 'connected' })
    expect(useAppStore.getState().sessions[0].status).toBe('connected')
  })

  it('removeSession removes a session by id', async () => {
    const { useAppStore } = await freshStore()
    const session = { id: 's1', protocol: 'ssh' as const, title: 'web01', status: 'connected' as const, hostId: null, profileId: null }
    useAppStore.getState().addSession(session)
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })
})

// ── profiles: dead state ──────────────────────────────────────────────────────
describe('profiles is dead state (no action mutates it)', () => {
  it('profiles starts as an empty array', async () => {
    const { useAppStore } = await freshStore()
    expect(useAppStore.getState().profiles).toEqual([])
  })

  it('setProfiles directly assigns profiles but no other action touches it', async () => {
    const { useAppStore } = await freshStore()
    const profiles = [{ id: 'p1', name: 'ssh', protocol: 'ssh' as const, shell: null, username: null, authMethod: 'password' as const, credentialRef: null, jumpHostId: null, extra: {} }]
    useAppStore.getState().setProfiles(profiles)
    expect(useAppStore.getState().profiles).toHaveLength(1)

    // No side actions (setSelectedTags, addSession, etc.) touch profiles
    useAppStore.getState().setSelectedTags(['x'])
    useAppStore.getState().addSession({ id: 's1', protocol: 'ssh', title: 't', status: 'connected', hostId: null, profileId: null })
    expect(useAppStore.getState().profiles).toHaveLength(1)
  })
})

// ── mapView sync ──────────────────────────────────────────────────────────────
describe('mapView state sync', () => {
  it('setAppView updates both appView and mapView.appView', async () => {
    const { useAppStore } = await freshStore()
    // Need loadMapView first so mapViewReady=true
    mockPreferencesGetMapView.mockResolvedValue({ version: 1, appView: 'list', mapMode: 'logical' })
    await useAppStore.getState().loadMapView()

    useAppStore.getState().setAppView('map')
    const state = useAppStore.getState()
    expect(state.appView).toBe('map')
    expect(state.mapView.appView).toBe('map')
  })
})
