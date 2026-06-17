export type OsType = 'windows' | 'linux' | 'macos' | 'unknown'
export type Protocol = 'ssh' | 'local_pty' | 'rdp' | 'vnc' | 'wsl'
export type AuthMethod = 'password' | 'key' | 'none'
export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type { HostLogVerbosity, UxProfile, UxProfileInput, TerminalAppearance, ChromeAppearance, HostListViewSettings, HostListGroupBy, HostListSortBy, HostListSortDir, HostListGroupFilter, HostListSection, MapViewSettings, MapViewMode, AppView, Report, ReportInput, ReportType, ReportConfig, ReportResult, ReportHostEntry, ReportHostStatus, ConnectivityTestConfig, ConnectivityTestEntry, ConnectivityTestResult, ConnectivityTestHostResult, InventoryConfig, InventoryEntry, InventoryResult, InventoryHostResult, InventoryHostData, ReportProgressEvent } from '@consoleri/core'
import type { HostLogVerbosity } from '@consoleri/core'

export interface LogEntry {
  id: string
  sessionId: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
  timestamp: string
}

export interface HostGroup {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

export interface Host {
  id: string
  name: string
  hostname: string
  port: number
  osType: OsType
  tags: string[]
  groupId: string | null
  notes: string
  defaultProfileId: string | null
  uxProfileId: string | null
  logVerbosity: HostLogVerbosity
  relatedHostIds: string[]
  gatewayHostId: string | null
  createdAt: string
  updatedAt: string
}

export interface ConnectionProfile {
  id: string
  name: string
  protocol: Protocol
  shell: string | null
  username: string | null
  authMethod: AuthMethod
  credentialRef: string | null
  jumpHostId: string | null
  extra: Record<string, unknown>
}

export interface Workspace {
  id: string
  name: string
  layoutJson: string
  isLastActive: boolean
}

export interface WorkspacePane {
  id: string
  workspaceId: string
  paneId: string
  sessionSnapshotJson: string
}

export interface SessionSnapshot {
  id: string
  hostId: string | null
  profileId: string | null
  protocol: Protocol
  title: string
  cwd: string | null
  cols: number
  rows: number
  scrollbackSerialized: string | null
  disconnectedAt: string | null
}

export interface SessionInfo {
  id: string
  protocol: Protocol
  title: string
  status: SessionStatus
  hostId: string | null
  profileId: string | null
  proxyUrl?: string
  rdpDestination?: string
  error?: string
}

export interface OpenSessionRequest {
  hostId?: string
  profileId?: string
  protocol?: Protocol
  title?: string
  localShell?: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl'
  wslDistro?: string
}

export interface HostFilter {
  search?: string
  tags?: string[]
  groupId?: string | null
}

export interface HostInput {
  name: string
  hostname: string
  port?: number
  osType?: OsType
  tags?: string[]
  groupId?: string | null
  notes?: string
  defaultProfileId?: string | null
  uxProfileId?: string | null
  logVerbosity?: HostLogVerbosity
  relatedHostIds?: string[]
  gatewayHostId?: string | null
}

export interface ProfileInput {
  name: string
  protocol: Protocol
  shell?: string | null
  username?: string | null
  authMethod?: AuthMethod
  credentialRef?: string | null
  jumpHostId?: string | null
  extra?: Record<string, unknown>
  password?: string
  privateKey?: string
  cloneFromProfileId?: string
  linkHostId?: string
}

export interface WslDistro {
  name: string
  state: string
  version: number
}

export type SshKeySource = 'ssh_dir' | 'custom'

export interface SshKeyInfo {
  id: string
  label: string
  privateKeyPath: string
  publicKeyPath: string | null
  fingerprint: string | null
  keyType: string | null
  encrypted: boolean
  source: SshKeySource
  exists: boolean
}

export interface AssignableHost {
  hostId: string
  hostName: string
  hostname: string
  profiles: Array<{
    profileId: string
    profileName: string
    username: string | null
    credentialRef: string | null
  }>
}

export interface DeployKeyRequest {
  hostId: string
  profileId?: string
  keyPath: string
  deployPassword?: string
  logId?: string
  openLog?: boolean
}

export interface DeployKeyResult {
  success: boolean
  message: string
  logId?: string
}

export interface PaneBinding {
  paneId: string
  sessionId: string | null
  protocol: Protocol
  title: string
  connectRequest: OpenSessionRequest
}

export interface WorkspaceState {
  layout: unknown
  panes: PaneBinding[]
}

export const IPC_CHANNELS = {
  hostsList: 'hosts:list',
  hostsGet: 'hosts:get',
  hostsCreate: 'hosts:create',
  hostsUpdate: 'hosts:update',
  hostsDelete: 'hosts:delete',
  hostsImport: 'hosts:import',
  groupsList: 'hosts:groups:list',
  groupsCreate: 'hosts:groups:create',
  profilesList: 'hosts:profiles:list',
  profilesCreate: 'hosts:profiles:create',
  profilesUpdate: 'hosts:profiles:update',
  profilesDelete: 'hosts:profiles:delete',
  profilesLink: 'hosts:profiles:link',
  profilesUnlink: 'hosts:profiles:unlink',
  profilesListHosts: 'hosts:profiles:list-hosts',
  profilesDuplicate: 'hosts:profiles:duplicate',
  credentialsStore: 'credentials:store',
  credentialsDelete: 'credentials:delete',
  sessionsOpen: 'sessions:open',
  sessionsClose: 'sessions:close',
  sessionsWrite: 'sessions:write',
  sessionsResize: 'sessions:resize',
  sessionsList: 'sessions:list',
  sessionsReconnect: 'sessions:reconnect',
  sessionsGetConnectRequest: 'sessions:get-connect-request',
  sessionsSnapshot: 'sessions:snapshot',
  sessionsRdpCredentials: 'sessions:rdp-credentials',
  sessionsVncPassword: 'sessions:vnc-password',
  wslList: 'wsl:list',
  workspaceSave: 'workspace:save',
  workspaceLoad: 'workspace:load',
  workspaceGetActive: 'workspace:get-active',
  sessionData: 'session:data',
  sessionExit: 'session:exit',
  sessionStatus: 'session:status',
  sessionLog: 'session:log',
  sessionsLogGet: 'sessions:log:get',
  sessionsLogAppend: 'sessions:log:append',
  sessionsLogOpenWindow: 'sessions:log:openWindow',
  sessionsOpenSessionWindow: 'sessions:openSessionWindow',
  keysList: 'keys:list',
  keysAdd: 'keys:add',
  keysRemove: 'keys:remove',
  keysPickFile: 'keys:pickFile',
  keysAssign: 'keys:assign',
  keysDeploy: 'keys:deploy',
  keysStorePassphrase: 'keys:storePassphrase',
  keysAssignableHosts: 'keys:assignableHosts',
  uxProfilesList: 'uxProfiles:list',
  uxProfilesGet: 'uxProfiles:get',
  uxProfilesCreate: 'uxProfiles:create',
  uxProfilesUpdate: 'uxProfiles:update',
  uxProfilesDelete: 'uxProfiles:delete',
  uxProfilesDuplicate: 'uxProfiles:duplicate',
  uxProfilesGetActive: 'uxProfiles:get-active',
  uxProfilesSetActive: 'uxProfiles:set-active',
  uxProfilesListHosts: 'uxProfiles:list-hosts',
  uxProfilesLinkHost: 'uxProfiles:link-host',
  uxProfilesUnlinkHost: 'uxProfiles:unlink-host',
  uxProfilesMigrateSidebarWidth: 'uxProfiles:migrate-sidebar-width',
  preferencesGetHostListView: 'preferences:get-host-list-view',
  preferencesSetHostListView: 'preferences:set-host-list-view',
  preferencesGetMapView: 'preferences:get-map-view',
  preferencesSetMapView: 'preferences:set-map-view',
  reportsList: 'reports:list',
  reportsGet: 'reports:get',
  reportsCreate: 'reports:create',
  reportsUpdate: 'reports:update',
  reportsDelete: 'reports:delete',
  reportsRun: 'reports:run',
  reportsOpenWindow: 'reports:openWindow',
  reportProgress: 'report:progress',
  reportUpdated: 'report:updated',
  clipboardReadText: 'clipboard:readText',
  clipboardWriteText: 'clipboard:writeText'
} as const
