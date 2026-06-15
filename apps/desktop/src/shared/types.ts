export type OsType = 'windows' | 'linux' | 'macos' | 'unknown'
export type Protocol = 'ssh' | 'local_pty' | 'rdp' | 'vnc' | 'wsl'
export type AuthMethod = 'password' | 'key' | 'none'
export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

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
  createdAt: string
  updatedAt: string
}

export interface ConnectionProfile {
  id: string
  hostId: string | null
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
}

export interface ProfileInput {
  hostId?: string | null
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
}

export interface WslDistro {
  name: string
  state: string
  version: number
}

export interface PaneBinding {
  paneId: string
  sessionId: string
  protocol: Protocol
  title: string
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
  credentialsStore: 'credentials:store',
  credentialsDelete: 'credentials:delete',
  sessionsOpen: 'sessions:open',
  sessionsClose: 'sessions:close',
  sessionsWrite: 'sessions:write',
  sessionsResize: 'sessions:resize',
  sessionsList: 'sessions:list',
  sessionsReconnect: 'sessions:reconnect',
  sessionsSnapshot: 'sessions:snapshot',
  sessionsRdpCredentials: 'sessions:rdp-credentials',
  sessionsVncPassword: 'sessions:vnc-password',
  wslList: 'wsl:list',
  workspaceSave: 'workspace:save',
  workspaceLoad: 'workspace:load',
  workspaceGetActive: 'workspace:get-active',
  sessionData: 'session:data',
  sessionExit: 'session:exit',
  sessionStatus: 'session:status'
} as const
