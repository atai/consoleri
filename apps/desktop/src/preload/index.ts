import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/types'
import type {
  Host,
  HostFilter,
  HostGroup,
  HostInput,
  OpenSessionRequest,
  ProfileInput,
  SessionInfo,
  WorkspaceState,
  ConnectionProfile,
  WslDistro
} from '../shared/types'

export interface ConsoleriAPI {
  hosts: {
    list: (filter?: HostFilter) => Promise<Host[]>
    get: (id: string) => Promise<Host | null>
    create: (input: HostInput) => Promise<Host>
    update: (id: string, input: Partial<HostInput>) => Promise<Host>
    delete: (id: string) => Promise<void>
    import: (items: HostInput[]) => Promise<Host[]>
  }
  groups: {
    list: () => Promise<HostGroup[]>
    create: (name: string, parentId?: string) => Promise<HostGroup>
  }
  profiles: {
    list: (hostId?: string) => Promise<ConnectionProfile[]>
    create: (input: ProfileInput) => Promise<ConnectionProfile>
    update: (id: string, input: Partial<ProfileInput>) => Promise<ConnectionProfile>
    delete: (id: string) => Promise<void>
  }
  credentials: {
    store: (ref: string, secret: string) => Promise<void>
    delete: (ref: string) => Promise<void>
  }
  sessions: {
    open: (request: OpenSessionRequest, cols?: number, rows?: number) => Promise<SessionInfo>
    close: (sessionId: string) => Promise<void>
    write: (sessionId: string, data: string) => Promise<void>
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>
    list: () => Promise<SessionInfo[]>
    reconnect: (sessionId: string) => Promise<SessionInfo | null>
    snapshot: (snapshot: {
      id: string
      hostId: string | null
      profileId: string | null
      protocol: string
      title: string
      cwd: string | null
      cols: number
      rows: number
      scrollbackSerialized: string | null
    }) => Promise<void>
    getRdpCredentials: (profileId: string) => Promise<{ username: string; password: string } | null>
    getVncPassword: (profileId: string) => Promise<string | null>
    onData: (cb: (payload: { id: string; data: string }) => void) => () => void
    onExit: (cb: (payload: { id: string; code: number }) => void) => () => void
    onStatus: (cb: (payload: { id: string; status: string; error?: string }) => void) => () => void
  }
  wsl: {
    list: () => Promise<WslDistro[]>
  }
  workspace: {
    save: (state: WorkspaceState, name?: string) => Promise<unknown>
    load: () => Promise<WorkspaceState>
    getActive: () => Promise<unknown>
  }
}

const consoleri: ConsoleriAPI = {
  hosts: {
    list: (filter) => ipcRenderer.invoke(IPC_CHANNELS.hostsList, filter),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.hostsGet, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.hostsCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.hostsUpdate, id, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.hostsDelete, id),
    import: (items) => ipcRenderer.invoke(IPC_CHANNELS.hostsImport, items)
  },
  groups: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.groupsList),
    create: (name, parentId) => ipcRenderer.invoke(IPC_CHANNELS.groupsCreate, name, parentId)
  },
  profiles: {
    list: (hostId) => ipcRenderer.invoke(IPC_CHANNELS.profilesList, hostId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.profilesUpdate, id, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.profilesDelete, id)
  },
  credentials: {
    store: (ref, secret) => ipcRenderer.invoke(IPC_CHANNELS.credentialsStore, ref, secret),
    delete: (ref) => ipcRenderer.invoke(IPC_CHANNELS.credentialsDelete, ref)
  },
  sessions: {
    open: (request, cols, rows) => ipcRenderer.invoke(IPC_CHANNELS.sessionsOpen, request, cols, rows),
    close: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.sessionsClose, sessionId),
    write: (sessionId, data) => ipcRenderer.invoke(IPC_CHANNELS.sessionsWrite, sessionId, data),
    resize: (sessionId, cols, rows) =>
      ipcRenderer.invoke(IPC_CHANNELS.sessionsResize, sessionId, cols, rows),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.sessionsList),
    reconnect: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.sessionsReconnect, sessionId),
    snapshot: (snapshot) => ipcRenderer.invoke(IPC_CHANNELS.sessionsSnapshot, snapshot),
    getRdpCredentials: (profileId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.sessionsRdpCredentials, profileId),
    getVncPassword: (profileId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.sessionsVncPassword, profileId),
    onData: (cb) => {
      const listener = (_: unknown, payload: { id: string; data: string }) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.sessionData, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionData, listener)
    },
    onExit: (cb) => {
      const listener = (_: unknown, payload: { id: string; code: number }) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.sessionExit, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionExit, listener)
    },
    onStatus: (cb) => {
      const listener = (_: unknown, payload: { id: string; status: string; error?: string }) =>
        cb(payload)
      ipcRenderer.on(IPC_CHANNELS.sessionStatus, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionStatus, listener)
    }
  },
  wsl: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.wslList)
  },
  workspace: {
    save: (state, name) => ipcRenderer.invoke(IPC_CHANNELS.workspaceSave, state, name),
    load: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceLoad),
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetActive)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('consoleri', consoleri)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore legacy non-isolated
  window.electron = electronAPI
  // @ts-ignore legacy non-isolated
  window.consoleri = consoleri
}
