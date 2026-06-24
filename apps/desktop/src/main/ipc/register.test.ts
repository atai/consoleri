import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../shared/types'

// ── ipcMain capture ──────────────────────────────────────────────────────────
type HandlerFn = (...args: unknown[]) => unknown
const handleMap = new Map<string, HandlerFn>()
const onMap = new Map<string, HandlerFn>()

// ── Hoisted mocks (needed because vi.mock is hoisted) ─────────────────────────
const {
  mockHostRepo,
  mockUxProfileRepo,
  mockSecretBackend,
  mockVaultSettings,
  mockStartVaultOidcLogin,
  mockLogoutVaultOidc,
  mockSessionManager,
  mockOpenLogWindow,
  mockRegisterLogContext,
  mockSshKeyService,
  mockSshKeyDeployer,
  mockAppPrefs,
  mockReportRepo,
  mockReportRunner
} = vi.hoisted(() => ({
  mockHostRepo: {
    listHosts: vi.fn(),
    getHost: vi.fn(),
    createHost: vi.fn(),
    updateHost: vi.fn(),
    deleteHost: vi.fn(),
    importHosts: vi.fn(),
    importHostsFromFile: vi.fn(),
    exportHostsBundle: vi.fn(),
    exportHostsToFile: vi.fn(),
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    linkHostProfile: vi.fn(),
    unlinkHostProfile: vi.fn(),
    listHostsForProfile: vi.fn(),
    duplicateProfile: vi.fn(),
    saveSessionSnapshot: vi.fn(),
    saveWorkspace: vi.fn(),
    loadWorkspace: vi.fn(),
    getActiveWorkspace: vi.fn()
  },
  mockUxProfileRepo: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    getActive: vi.fn(),
    setActive: vi.fn(),
    listHosts: vi.fn(),
    linkHost: vi.fn(),
    unlinkHost: vi.fn()
  },
  mockSecretBackend: { store: vi.fn(), delete: vi.fn() },
  mockVaultSettings: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    testConnection: vi.fn(),
    getStatus: vi.fn()
  },
  mockStartVaultOidcLogin: vi.fn(),
  mockLogoutVaultOidc: vi.fn(),
  mockSessionManager: {
    setWindow: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    list: vi.fn(),
    reconnect: vi.fn(),
    getConnectRequest: vi.fn(),
    getCredentialsForRdp: vi.fn(),
    getCredentialsForVnc: vi.fn(),
    appendSessionLog: vi.fn(),
    getLogEntries: vi.fn()
  },
  mockOpenLogWindow: vi.fn(),
  mockRegisterLogContext: vi.fn(),
  mockSshKeyService: {
    listKeys: vi.fn(),
    addCustomKey: vi.fn(),
    removeCustomKey: vi.fn(),
    pickKeyFile: vi.fn(),
    assignToProfile: vi.fn(),
    storePassphrase: vi.fn(),
    listAssignableHosts: vi.fn()
  },
  mockSshKeyDeployer: { deploy: vi.fn(() => Promise.resolve({ success: true, message: 'ok' })) },
  mockAppPrefs: {
    getHostListView: vi.fn(),
    setHostListView: vi.fn(),
    getMapView: vi.fn(),
    setMapView: vi.fn(),
    getAppSettings: vi.fn().mockReturnValue({ autoOpenConnectionLog: false, sessionOpenMode: 'workspace' }),
    setAppSettings: vi.fn().mockReturnValue({ autoOpenConnectionLog: false, sessionOpenMode: 'workspace' })
  },
  mockReportRepo: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  mockReportRunner: { run: vi.fn() }
}))

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: HandlerFn) => handleMap.set(channel, fn)),
    on: vi.fn((channel: string, fn: HandlerFn) => onMap.set(channel, fn))
  },
  clipboard: {
    readText: vi.fn(() => 'clipboard-text'),
    writeText: vi.fn()
  },
  app: { getPath: () => '/tmp/test' }
}))

vi.mock('../hosts/HostRepository', () => ({ hostRepository: mockHostRepo }))
vi.mock('../hosts/ProfileRepository', () => ({ profileRepository: mockHostRepo }))
vi.mock('../hosts/WorkspaceRepository', () => ({ workspaceRepository: mockHostRepo }))
vi.mock('../hosts/hostImportExportServiceInstance', () => ({
  hostImportExportService: {
    importHosts: mockHostRepo.importHosts,
    importHostsFromFile: mockHostRepo.importHostsFromFile,
    exportHostsBundle: mockHostRepo.exportHostsBundle,
    exportHostsToFile: mockHostRepo.exportHostsToFile
  }
}))
vi.mock('../ux/UxProfileRepository', () => ({ uxProfileRepository: mockUxProfileRepo }))
vi.mock('../secrets/SecretBackendService', () => ({ secretBackendService: mockSecretBackend }))
vi.mock('../vault/VaultSettingsRepository', () => ({ vaultSettingsRepository: mockVaultSettings }))
vi.mock('../vault/VaultOidcLogin', () => ({
  startVaultOidcLogin: mockStartVaultOidcLogin,
  logoutVaultOidc: mockLogoutVaultOidc
}))
vi.mock('../sessions/SessionManager', () => ({ sessionManager: mockSessionManager }))
vi.mock('../sessions/shellUtils', () => ({ listWslDistros: vi.fn(() => []) }))
vi.mock('../windows/LogWindow', () => ({
  openLogWindow: mockOpenLogWindow,
  registerLogContext: mockRegisterLogContext
}))
vi.mock('../windows/ReportWindow', () => ({ openReportWindow: vi.fn() }))
vi.mock('../windows/SessionWindow', () => ({ openSessionWindow: vi.fn() }))
vi.mock('../keys/SshKeyService', () => ({ sshKeyService: mockSshKeyService }))
vi.mock('../keys/SshKeyDeployer', () => ({ sshKeyDeployer: mockSshKeyDeployer }))
vi.mock('../preferences/AppPreferencesRepository', () => ({
  appPreferencesRepository: mockAppPrefs
}))
vi.mock('../reports/ReportRepository', () => ({ reportRepository: mockReportRepo }))
vi.mock('../reports/ReportRunner', () => ({ reportRunner: mockReportRunner }))
vi.mock('../settings/appImportExportServiceInstance', () => ({
  appImportExportService: {
    exportAppBundle: vi.fn(),
    exportAppToFile: vi.fn(),
    importAppFromFile: vi.fn()
  }
}))
vi.mock('../backup/backupServiceInstance', () => ({
  backupService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    listBackups: vi.fn(),
    createBackupNow: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
    openBackupFolder: vi.fn()
  }
}))

// ── Setup ─────────────────────────────────────────────────────────────────────
import { registerIpcHandlers } from './register'

const FAKE_EVENT = {} as Electron.IpcMainInvokeEvent
const getWindow = vi.fn(() => null as Electron.BrowserWindow | null)

beforeEach(() => {
  handleMap.clear()
  onMap.clear()
  vi.clearAllMocks()
  registerIpcHandlers(getWindow)
})

// ── Inventory: all expected channels are registered ───────────────────────────
describe('IPC channel inventory', () => {
  const EXPECTED_HANDLE_CHANNELS = [
    IPC_CHANNELS.hostsList,
    IPC_CHANNELS.hostsGet,
    IPC_CHANNELS.hostsCreate,
    IPC_CHANNELS.hostsUpdate,
    IPC_CHANNELS.hostsDelete,
    IPC_CHANNELS.hostsImport,
    IPC_CHANNELS.hostsImportFromFile,
    IPC_CHANNELS.hostsExport,
    IPC_CHANNELS.hostsExportToFile,
    IPC_CHANNELS.groupsList,
    IPC_CHANNELS.groupsCreate,
    IPC_CHANNELS.profilesList,
    IPC_CHANNELS.profilesCreate,
    IPC_CHANNELS.profilesUpdate,
    IPC_CHANNELS.profilesDelete,
    IPC_CHANNELS.profilesLink,
    IPC_CHANNELS.profilesUnlink,
    IPC_CHANNELS.profilesListHosts,
    IPC_CHANNELS.profilesDuplicate,
    IPC_CHANNELS.credentialsStore,
    IPC_CHANNELS.credentialsDelete,
    IPC_CHANNELS.vaultGetSettings,
    IPC_CHANNELS.vaultUpdateSettings,
    IPC_CHANNELS.vaultTestConnection,
    IPC_CHANNELS.vaultStatus,
    IPC_CHANNELS.vaultLogin,
    IPC_CHANNELS.vaultLogout,
    IPC_CHANNELS.sessionsOpen,
    IPC_CHANNELS.sessionsClose,
    IPC_CHANNELS.sessionsList,
    IPC_CHANNELS.sessionsReconnect,
    IPC_CHANNELS.sessionsGetConnectRequest,
    IPC_CHANNELS.sessionsRdpCredentials,
    IPC_CHANNELS.sessionsVncPassword,
    IPC_CHANNELS.sessionsSnapshot,
    IPC_CHANNELS.wslList,
    IPC_CHANNELS.workspaceSave,
    IPC_CHANNELS.workspaceLoad,
    IPC_CHANNELS.workspaceGetActive,
    IPC_CHANNELS.sessionsLogGet,
    IPC_CHANNELS.sessionsLogAppend,
    IPC_CHANNELS.sessionsLogOpenWindow,
    IPC_CHANNELS.sessionsOpenSessionWindow,
    IPC_CHANNELS.keysList,
    IPC_CHANNELS.keysAdd,
    IPC_CHANNELS.keysRemove,
    IPC_CHANNELS.keysPickFile,
    IPC_CHANNELS.keysAssign,
    IPC_CHANNELS.keysDeploy,
    IPC_CHANNELS.keysStorePassphrase,
    IPC_CHANNELS.keysAssignableHosts,
    IPC_CHANNELS.uxProfilesList,
    IPC_CHANNELS.uxProfilesGet,
    IPC_CHANNELS.uxProfilesCreate,
    IPC_CHANNELS.uxProfilesUpdate,
    IPC_CHANNELS.uxProfilesDelete,
    IPC_CHANNELS.uxProfilesDuplicate,
    IPC_CHANNELS.uxProfilesGetActive,
    IPC_CHANNELS.uxProfilesSetActive,
    IPC_CHANNELS.uxProfilesListHosts,
    IPC_CHANNELS.uxProfilesLinkHost,
    IPC_CHANNELS.uxProfilesUnlinkHost,
    IPC_CHANNELS.clipboardReadText,
    IPC_CHANNELS.clipboardWriteText,
    IPC_CHANNELS.preferencesGetHostListView,
    IPC_CHANNELS.preferencesSetHostListView,
    IPC_CHANNELS.preferencesGetMapView,
    IPC_CHANNELS.preferencesSetMapView,
    IPC_CHANNELS.preferencesGetAppSettings,
    IPC_CHANNELS.preferencesSetAppSettings,
    IPC_CHANNELS.reportsList,
    IPC_CHANNELS.reportsGet,
    IPC_CHANNELS.reportsCreate,
    IPC_CHANNELS.reportsUpdate,
    IPC_CHANNELS.reportsDelete,
    IPC_CHANNELS.reportsRun,
    IPC_CHANNELS.reportsOpenWindow,
    IPC_CHANNELS.appExport,
    IPC_CHANNELS.appExportToFile,
    IPC_CHANNELS.appImportFromFile,
    IPC_CHANNELS.backupGetSettings,
    IPC_CHANNELS.backupUpdateSettings,
    IPC_CHANNELS.backupList,
    IPC_CHANNELS.backupCreateNow,
    IPC_CHANNELS.backupRestore,
    IPC_CHANNELS.backupDelete,
    IPC_CHANNELS.backupOpenFolder
  ] as const

  const EXPECTED_ON_CHANNELS = [
    IPC_CHANNELS.sessionsWrite,
    IPC_CHANNELS.sessionsResize
  ] as const

  it('registers all expected ipcMain.handle channels', () => {
    for (const ch of EXPECTED_HANDLE_CHANNELS) {
      expect(handleMap.has(ch), `Missing handle channel: ${ch}`).toBe(true)
    }
  })

  it('registers all expected ipcMain.on channels', () => {
    for (const ch of EXPECTED_ON_CHANNELS) {
      expect(onMap.has(ch), `Missing on channel: ${ch}`).toBe(true)
    }
  })

  it('does not register unexpected handle channels', () => {
    const registered = [...handleMap.keys()].sort()
    const expected = [...EXPECTED_HANDLE_CHANNELS].sort()
    expect(registered).toEqual(expected)
  })

  it('does not register unexpected on channels', () => {
    const registered = [...onMap.keys()].sort()
    const expected = [...EXPECTED_ON_CHANNELS].sort()
    expect(registered).toEqual(expected)
  })
})

// ── Routing: hosts ────────────────────────────────────────────────────────────
describe('hosts routing', () => {
  it('hosts:list → hostRepository.listHosts', async () => {
    await handleMap.get(IPC_CHANNELS.hostsList)!(FAKE_EVENT, {})
    expect(mockHostRepo.listHosts).toHaveBeenCalledWith({})
  })

  it('hosts:list with undefined filter → defaults to empty filter', async () => {
    vi.mocked(mockHostRepo.listHosts).mockReturnValue([])
    await expect(
      handleMap.get(IPC_CHANNELS.hostsList)!(FAKE_EVENT, undefined)
    ).resolves.not.toThrow()
    expect(mockHostRepo.listHosts).toHaveBeenCalledWith({})
  })

  it('hosts:get → hostRepository.getHost', async () => {
    await handleMap.get(IPC_CHANNELS.hostsGet)!(FAKE_EVENT, 'host-1')
    expect(mockHostRepo.getHost).toHaveBeenCalledWith('host-1')
  })

  it('hosts:create → hostRepository.createHost', async () => {
    const input = { name: 'web01', hostname: '10.0.0.1' }
    await handleMap.get(IPC_CHANNELS.hostsCreate)!(FAKE_EVENT, input)
    expect(mockHostRepo.createHost).toHaveBeenCalledWith(input)
  })

  it('hosts:update → hostRepository.updateHost', async () => {
    await handleMap.get(IPC_CHANNELS.hostsUpdate)!(FAKE_EVENT, 'h1', { name: 'new' })
    expect(mockHostRepo.updateHost).toHaveBeenCalledWith('h1', { name: 'new' })
  })

  it('hosts:delete → hostRepository.deleteHost', async () => {
    await handleMap.get(IPC_CHANNELS.hostsDelete)!(FAKE_EVENT, 'h1')
    expect(mockHostRepo.deleteHost).toHaveBeenCalledWith('h1')
  })

  it('hosts:import → hostRepository.importHosts', async () => {
    const payload = { version: 1, hosts: [] }
    await handleMap.get(IPC_CHANNELS.hostsImport)!(FAKE_EVENT, payload)
    expect(mockHostRepo.importHosts).toHaveBeenCalledWith(payload)
  })

  it('hosts:import-from-file → hostRepository.importHostsFromFile', async () => {
    await handleMap.get(IPC_CHANNELS.hostsImportFromFile)!(FAKE_EVENT)
    expect(mockHostRepo.importHostsFromFile).toHaveBeenCalled()
  })

  it('hosts:export → hostRepository.exportHostsBundle', async () => {
    await handleMap.get(IPC_CHANNELS.hostsExport)!(FAKE_EVENT)
    expect(mockHostRepo.exportHostsBundle).toHaveBeenCalled()
  })

  it('hosts:export-to-file → hostRepository.exportHostsToFile', async () => {
    await handleMap.get(IPC_CHANNELS.hostsExportToFile)!(FAKE_EVENT)
    expect(mockHostRepo.exportHostsToFile).toHaveBeenCalled()
  })
})

// ── Routing: groups ───────────────────────────────────────────────────────────
describe('groups routing', () => {
  it('hosts:groups:list → hostRepository.listGroups', async () => {
    await handleMap.get(IPC_CHANNELS.groupsList)!(FAKE_EVENT)
    expect(mockHostRepo.listGroups).toHaveBeenCalled()
  })

  it('hosts:groups:create → hostRepository.createGroup (null parent when undefined)', async () => {
    await handleMap.get(IPC_CHANNELS.groupsCreate)!(FAKE_EVENT, 'infra', undefined)
    expect(mockHostRepo.createGroup).toHaveBeenCalledWith('infra', null)
  })

  it('hosts:groups:create → hostRepository.createGroup (with parent)', async () => {
    await handleMap.get(IPC_CHANNELS.groupsCreate)!(FAKE_EVENT, 'db', 'parent-id')
    expect(mockHostRepo.createGroup).toHaveBeenCalledWith('db', 'parent-id')
  })
})

// ── Routing: profiles ─────────────────────────────────────────────────────────
describe('profiles routing', () => {
  it('hosts:profiles:list → hostRepository.listProfiles', async () => {
    await handleMap.get(IPC_CHANNELS.profilesList)!(FAKE_EVENT, 'host-1')
    expect(mockHostRepo.listProfiles).toHaveBeenCalledWith('host-1')
  })

  it('hosts:profiles:create → hostRepository.createProfile', async () => {
    const input = { name: 'ssh', protocol: 'ssh' }
    await handleMap.get(IPC_CHANNELS.profilesCreate)!(FAKE_EVENT, input)
    expect(mockHostRepo.createProfile).toHaveBeenCalledWith(input)
  })

  it('hosts:profiles:update → hostRepository.updateProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesUpdate)!(FAKE_EVENT, 'p1', { name: 'new' })
    expect(mockHostRepo.updateProfile).toHaveBeenCalledWith('p1', { name: 'new' })
  })

  it('hosts:profiles:delete → hostRepository.deleteProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesDelete)!(FAKE_EVENT, 'p1')
    expect(mockHostRepo.deleteProfile).toHaveBeenCalledWith('p1')
  })

  it('hosts:profiles:link → hostRepository.linkHostProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesLink)!(FAKE_EVENT, 'h1', 'p1')
    expect(mockHostRepo.linkHostProfile).toHaveBeenCalledWith('h1', 'p1')
  })

  it('hosts:profiles:unlink → hostRepository.unlinkHostProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesUnlink)!(FAKE_EVENT, 'h1', 'p1')
    expect(mockHostRepo.unlinkHostProfile).toHaveBeenCalledWith('h1', 'p1')
  })

  it('hosts:profiles:list-hosts → hostRepository.listHostsForProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesListHosts)!(FAKE_EVENT, 'p1')
    expect(mockHostRepo.listHostsForProfile).toHaveBeenCalledWith('p1')
  })

  it('hosts:profiles:duplicate → hostRepository.duplicateProfile', async () => {
    await handleMap.get(IPC_CHANNELS.profilesDuplicate)!(FAKE_EVENT, 'src', 'h1', 'copy')
    expect(mockHostRepo.duplicateProfile).toHaveBeenCalledWith('src', 'h1', 'copy')
  })
})

// ── Routing: credentials ──────────────────────────────────────────────────────
describe('credentials routing', () => {
  it('credentials:store → secretBackendService.store', async () => {
    await handleMap.get(IPC_CHANNELS.credentialsStore)!(FAKE_EVENT, 'profile:x:password', 's3cr3t')
    expect(mockSecretBackend.store).toHaveBeenCalledWith('profile:x:password', 's3cr3t')
  })

  it('credentials:delete → secretBackendService.delete', async () => {
    await handleMap.get(IPC_CHANNELS.credentialsDelete)!(FAKE_EVENT, 'profile:x:password')
    expect(mockSecretBackend.delete).toHaveBeenCalledWith('profile:x:password')
  })
})

// ── Routing: vault ────────────────────────────────────────────────────────────
describe('vault routing', () => {
  it('vault:getSettings → vaultSettingsRepository.getSettings', async () => {
    await handleMap.get(IPC_CHANNELS.vaultGetSettings)!(FAKE_EVENT)
    expect(mockVaultSettings.getSettings).toHaveBeenCalled()
  })

  it('vault:updateSettings → vaultSettingsRepository.updateSettings', async () => {
    const patch = { enabled: true }
    await handleMap.get(IPC_CHANNELS.vaultUpdateSettings)!(FAKE_EVENT, patch)
    expect(mockVaultSettings.updateSettings).toHaveBeenCalledWith(patch)
  })

  it('vault:testConnection → vaultSettingsRepository.testConnection', async () => {
    await handleMap.get(IPC_CHANNELS.vaultTestConnection)!(FAKE_EVENT)
    expect(mockVaultSettings.testConnection).toHaveBeenCalled()
  })

  it('vault:status → vaultSettingsRepository.getStatus', async () => {
    await handleMap.get(IPC_CHANNELS.vaultStatus)!(FAKE_EVENT)
    expect(mockVaultSettings.getStatus).toHaveBeenCalled()
  })

  it('vault:login → startVaultOidcLogin', async () => {
    await handleMap.get(IPC_CHANNELS.vaultLogin)!(FAKE_EVENT)
    expect(mockStartVaultOidcLogin).toHaveBeenCalled()
  })

  it('vault:logout → logoutVaultOidc', async () => {
    await handleMap.get(IPC_CHANNELS.vaultLogout)!(FAKE_EVENT)
    expect(mockLogoutVaultOidc).toHaveBeenCalled()
  })
})

// ── Routing: sessions ─────────────────────────────────────────────────────────
describe('sessions routing', () => {
  it('sessions:open → sessionManager.open (no window)', async () => {
    getWindow.mockReturnValue(null)
    await handleMap.get(IPC_CHANNELS.sessionsOpen)!(FAKE_EVENT, { protocol: 'ssh' }, 80, 24)
    expect(mockSessionManager.open).toHaveBeenCalledWith({ protocol: 'ssh' }, 80, 24)
    expect(mockSessionManager.setWindow).not.toHaveBeenCalled()
  })

  it('sessions:open → sessionManager.setWindow when window is present', async () => {
    const fakeWin = {} as Electron.BrowserWindow
    getWindow.mockReturnValue(fakeWin)
    await handleMap.get(IPC_CHANNELS.sessionsOpen)!(FAKE_EVENT, { protocol: 'ssh' })
    expect(mockSessionManager.setWindow).toHaveBeenCalledWith(fakeWin)
  })

  it('sessions:close → sessionManager.close', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsClose)!(FAKE_EVENT, 'sess-1')
    expect(mockSessionManager.close).toHaveBeenCalledWith('sess-1')
  })

  it('sessions:write (on) → sessionManager.write', () => {
    onMap.get(IPC_CHANNELS.sessionsWrite)!(FAKE_EVENT, 'sess-1', 'ls\n')
    expect(mockSessionManager.write).toHaveBeenCalledWith('sess-1', 'ls\n')
  })

  it('sessions:resize (on) → sessionManager.resize', () => {
    onMap.get(IPC_CHANNELS.sessionsResize)!(FAKE_EVENT, 'sess-1', 120, 40)
    expect(mockSessionManager.resize).toHaveBeenCalledWith('sess-1', 120, 40)
  })

  it('sessions:list → sessionManager.list', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsList)!(FAKE_EVENT)
    expect(mockSessionManager.list).toHaveBeenCalled()
  })

  it('sessions:reconnect → sessionManager.reconnect', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsReconnect)!(FAKE_EVENT, 'sess-1')
    expect(mockSessionManager.reconnect).toHaveBeenCalledWith('sess-1')
  })

  it('sessions:rdp-credentials → sessionManager.getCredentialsForRdp', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsRdpCredentials)!(FAKE_EVENT, 'prof-1')
    expect(mockSessionManager.getCredentialsForRdp).toHaveBeenCalledWith('prof-1')
  })

  it('sessions:vnc-password → sessionManager.getCredentialsForVnc', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsVncPassword)!(FAKE_EVENT, 'prof-1')
    expect(mockSessionManager.getCredentialsForVnc).toHaveBeenCalledWith('prof-1')
  })

  it('sessions:snapshot → hostRepository.saveSessionSnapshot', async () => {
    const snap = { id: 's1', hostId: null, profileId: null, protocol: 'ssh', title: 't', cwd: null, cols: 80, rows: 24, scrollbackSerialized: null }
    await handleMap.get(IPC_CHANNELS.sessionsSnapshot)!(FAKE_EVENT, snap)
    expect(mockHostRepo.saveSessionSnapshot).toHaveBeenCalledWith(snap)
  })

  it('sessions:log:get → sessionManager.getLogEntries', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsLogGet)!(FAKE_EVENT, 'sess-1')
    expect(mockSessionManager.getLogEntries).toHaveBeenCalledWith('sess-1')
  })

  it('sessions:log:append → sessionManager.appendSessionLog', async () => {
    await handleMap.get(IPC_CHANNELS.sessionsLogAppend)!(FAKE_EVENT, 'sess-1', 'info', 'connected')
    expect(mockSessionManager.appendSessionLog).toHaveBeenCalledWith('sess-1', 'info', 'connected')
  })
})

// ── Routing: workspace ────────────────────────────────────────────────────────
describe('workspace routing', () => {
  it('workspace:save → hostRepository.saveWorkspace', async () => {
    const state = { layout: null, panes: [] }
    await handleMap.get(IPC_CHANNELS.workspaceSave)!(FAKE_EVENT, state, 'Main')
    expect(mockHostRepo.saveWorkspace).toHaveBeenCalledWith(state, 'Main')
  })

  it('workspace:load → hostRepository.loadWorkspace', async () => {
    await handleMap.get(IPC_CHANNELS.workspaceLoad)!(FAKE_EVENT)
    expect(mockHostRepo.loadWorkspace).toHaveBeenCalled()
  })

  it('workspace:get-active → hostRepository.getActiveWorkspace', async () => {
    await handleMap.get(IPC_CHANNELS.workspaceGetActive)!(FAKE_EVENT)
    expect(mockHostRepo.getActiveWorkspace).toHaveBeenCalled()
  })
})

// ── Routing: keys ─────────────────────────────────────────────────────────────
describe('keys routing', () => {
  it('keys:list → sshKeyService.listKeys', async () => {
    await handleMap.get(IPC_CHANNELS.keysList)!(FAKE_EVENT)
    expect(mockSshKeyService.listKeys).toHaveBeenCalled()
  })

  it('keys:add → sshKeyService.addCustomKey', async () => {
    await handleMap.get(IPC_CHANNELS.keysAdd)!(FAKE_EVENT, '/path/id_rsa', 'my key')
    expect(mockSshKeyService.addCustomKey).toHaveBeenCalledWith('/path/id_rsa', 'my key')
  })

  it('keys:remove → sshKeyService.removeCustomKey', async () => {
    await handleMap.get(IPC_CHANNELS.keysRemove)!(FAKE_EVENT, 'key-id')
    expect(mockSshKeyService.removeCustomKey).toHaveBeenCalledWith('key-id')
  })

  it('keys:storePassphrase → sshKeyService.storePassphrase', async () => {
    await handleMap.get(IPC_CHANNELS.keysStorePassphrase)!(FAKE_EVENT, '/path/id_rsa', 'pass')
    expect(mockSshKeyService.storePassphrase).toHaveBeenCalledWith('/path/id_rsa', 'pass')
  })

  it('keys:assignableHosts → sshKeyService.listAssignableHosts', async () => {
    await handleMap.get(IPC_CHANNELS.keysAssignableHosts)!(FAKE_EVENT)
    expect(mockSshKeyService.listAssignableHosts).toHaveBeenCalled()
  })
})

// ── Routing: uxProfiles ───────────────────────────────────────────────────────
describe('uxProfiles routing', () => {
  it('uxProfiles:list → uxProfileRepository.list', async () => {
    await handleMap.get(IPC_CHANNELS.uxProfilesList)!(FAKE_EVENT, 'h1')
    expect(mockUxProfileRepo.list).toHaveBeenCalledWith('h1')
  })

  it('uxProfiles:get-active → uxProfileRepository.getActive', async () => {
    await handleMap.get(IPC_CHANNELS.uxProfilesGetActive)!(FAKE_EVENT)
    expect(mockUxProfileRepo.getActive).toHaveBeenCalled()
  })

  it('uxProfiles:set-active → uxProfileRepository.setActive', async () => {
    await handleMap.get(IPC_CHANNELS.uxProfilesSetActive)!(FAKE_EVENT, 'profile-id')
    expect(mockUxProfileRepo.setActive).toHaveBeenCalledWith('profile-id')
  })

  it('uxProfiles:link-host → uxProfileRepository.linkHost', async () => {
    await handleMap.get(IPC_CHANNELS.uxProfilesLinkHost)!(FAKE_EVENT, 'h1', 'prof-1')
    expect(mockUxProfileRepo.linkHost).toHaveBeenCalledWith('h1', 'prof-1')
  })

  it('uxProfiles:unlink-host → uxProfileRepository.unlinkHost', async () => {
    await handleMap.get(IPC_CHANNELS.uxProfilesUnlinkHost)!(FAKE_EVENT, 'h1')
    expect(mockUxProfileRepo.unlinkHost).toHaveBeenCalledWith('h1')
  })
})

// ── Routing: preferences ──────────────────────────────────────────────────────
describe('preferences routing', () => {
  it('preferences:get-host-list-view → appPreferencesRepository.getHostListView', async () => {
    await handleMap.get(IPC_CHANNELS.preferencesGetHostListView)!(FAKE_EVENT)
    expect(mockAppPrefs.getHostListView).toHaveBeenCalled()
  })

  it('preferences:set-host-list-view → appPreferencesRepository.setHostListView', async () => {
    const patch = { groupBy: 'none' }
    await handleMap.get(IPC_CHANNELS.preferencesSetHostListView)!(FAKE_EVENT, patch)
    expect(mockAppPrefs.setHostListView).toHaveBeenCalledWith(patch)
  })

  it('preferences:get-map-view → appPreferencesRepository.getMapView', async () => {
    await handleMap.get(IPC_CHANNELS.preferencesGetMapView)!(FAKE_EVENT)
    expect(mockAppPrefs.getMapView).toHaveBeenCalled()
  })

  it('preferences:set-map-view → appPreferencesRepository.setMapView', async () => {
    const patch = { appView: 'list' }
    await handleMap.get(IPC_CHANNELS.preferencesSetMapView)!(FAKE_EVENT, patch)
    expect(mockAppPrefs.setMapView).toHaveBeenCalledWith(patch)
  })
})

// ── Routing: reports ──────────────────────────────────────────────────────────
describe('reports routing', () => {
  it('reports:list → reportRepository.list', async () => {
    await handleMap.get(IPC_CHANNELS.reportsList)!(FAKE_EVENT)
    expect(mockReportRepo.list).toHaveBeenCalled()
  })

  it('reports:get → reportRepository.get', async () => {
    await handleMap.get(IPC_CHANNELS.reportsGet)!(FAKE_EVENT, 'r1')
    expect(mockReportRepo.get).toHaveBeenCalledWith('r1')
  })

  it('reports:run → reportRunner.run', async () => {
    await handleMap.get(IPC_CHANNELS.reportsRun)!(FAKE_EVENT, 'r1')
    expect(mockReportRunner.run).toHaveBeenCalledWith('r1')
  })
})

// ── Routing: clipboard ────────────────────────────────────────────────────────
describe('clipboard routing', () => {
  it('clipboard:readText → clipboard.readText', async () => {
    const { clipboard } = await import('electron')
    const result = await handleMap.get(IPC_CHANNELS.clipboardReadText)!(FAKE_EVENT)
    expect(clipboard.readText).toHaveBeenCalled()
    expect(result).toBe('clipboard-text')
  })

  it('clipboard:writeText → clipboard.writeText', async () => {
    const { clipboard } = await import('electron')
    await handleMap.get(IPC_CHANNELS.clipboardWriteText)!(FAKE_EVENT, 'hello')
    expect(clipboard.writeText).toHaveBeenCalledWith('hello')
  })
})
