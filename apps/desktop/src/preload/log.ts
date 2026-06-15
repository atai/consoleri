import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { LogEntry } from '../shared/types'

const logApi = {
  getSessionId: (): string => {
    const params = new URLSearchParams(window.location.search)
    return params.get('sessionId') ?? ''
  },
  getEntries: (sessionId: string): Promise<LogEntry[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.sessionsLogGet, sessionId),
  onLog: (cb: (entry: LogEntry) => void): (() => void) => {
    const listener = (_: unknown, entry: LogEntry) => cb(entry)
    ipcRenderer.on(IPC_CHANNELS.sessionLog, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionLog, listener)
  }
}

contextBridge.exposeInMainWorld('logApi', logApi)
