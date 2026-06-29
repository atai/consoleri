import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  Report,
  ReportProgressEvent,
  ReportResult
} from '../shared/types'

const reportApi = {
  getReportId: (): string => {
    const params = new URLSearchParams(window.location.search)
    return params.get('reportId') ?? ''
  },
  getReport: (reportId: string): Promise<Report | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.reportsGet, reportId),
  run: (reportId: string): Promise<ReportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.reportsRun, reportId),
  onProgress: (cb: (event: ReportProgressEvent) => void): (() => void) => {
    const listener = (_: unknown, event: ReportProgressEvent) => cb(event)
    ipcRenderer.on(IPC_CHANNELS.reportProgress, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.reportProgress, listener)
  },
  writeClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.clipboardWriteText, text),
  saveHtml: (
    content: string,
    defaultName: string
  ): Promise<{ path: string } | { canceled: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.reportsSaveHtml, { content, defaultName }),
  listHosts: () => ipcRenderer.invoke(IPC_CHANNELS.hostsList, {}),
  listProfiles: (hostId?: string) => ipcRenderer.invoke(IPC_CHANNELS.profilesList, hostId)
}

contextBridge.exposeInMainWorld('reportApi', reportApi)
