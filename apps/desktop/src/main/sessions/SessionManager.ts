import { nanoid } from 'nanoid'
import type { BrowserWindow } from 'electron'
import { isTerminalProtocol } from '@consoleri/core'
import type { OpenSessionRequest, SessionInfo, SessionStatus } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { credentialVault } from '../hosts/CredentialVault'
import { connectionLog } from './ConnectionLog'
import { sessionFactory } from './SessionFactory'
import type { ITransport } from './Transport'
import { RdpProxy } from './RdpProxy'
import { VncProxy } from './VncProxy'
import { formatSessionWindowTitle } from '../windowTitles'

interface ManagedSession {
  info: SessionInfo
  transport: ITransport | null
  rdpProxy?: RdpProxy
  vncProxy?: VncProxy
  reconnectMeta?: OpenSessionRequest & { cols: number; rows: number }
  connecting?: boolean
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>()
  private window: BrowserWindow | null = null
  private logWindow: BrowserWindow | null = null
  private sessionWindows = new Map<string, BrowserWindow>()

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  getConnectRequest(sessionId: string): OpenSessionRequest | null {
    const existing = this.sessions.get(sessionId)
    if (!existing?.reconnectMeta) return null
    const { cols: _cols, rows: _rows, ...request } = existing.reconnectMeta
    return request
  }

  private send(channel: string, payload: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
    if (this.logWindow && !this.logWindow.isDestroyed()) {
      this.logWindow.webContents.send(channel, payload)
    }

    const sessionId = this.extractSessionId(channel, payload)
    if (sessionId) {
      const sessionWin = this.sessionWindows.get(sessionId)
      if (sessionWin && !sessionWin.isDestroyed()) {
        sessionWin.webContents.send(channel, payload)
      }
    }
  }

  private extractSessionId(channel: string, payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) return null
    const record = payload as Record<string, unknown>
    if (channel === IPC_CHANNELS.sessionLog) {
      return typeof record.sessionId === 'string' ? record.sessionId : null
    }
    if (
      channel === IPC_CHANNELS.sessionData ||
      channel === IPC_CHANNELS.sessionStatus ||
      channel === IPC_CHANNELS.sessionExit
    ) {
      return typeof record.id === 'string' ? record.id : null
    }
    return null
  }

  registerSessionWindow(sessionId: string, win: BrowserWindow): void {
    this.sessionWindows.set(sessionId, win)
  }

  unregisterSessionWindow(sessionId: string): void {
    this.sessionWindows.delete(sessionId)
  }

  private updateSessionWindowTitle(sessionId: string): void {
    const win = this.sessionWindows.get(sessionId)
    const session = this.sessions.get(sessionId)
    if (win && !win.isDestroyed() && session) {
      win.setTitle(formatSessionWindowTitle(session.info))
    }
  }

  private appendLog(sessionId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const entry = connectionLog.append(sessionId, level, message)
    if (entry) this.send(IPC_CHANNELS.sessionLog, entry)
  }

  private updateStatus(id: string, status: SessionStatus, error?: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.info.status = status
    if (error) session.info.error = error
    else delete session.info.error
    session.connecting = status === 'connecting'
    this.send(IPC_CHANNELS.sessionStatus, { id, status, error })
  }

  private attachTransport(id: string, transport: ITransport): void {
    transport.on('data', (data: string) => {
      this.send(IPC_CHANNELS.sessionData, { id, data })
    })
    transport.on('exit', (code: number) => {
      this.updateStatus(id, 'disconnected')
      this.appendLog(id, 'info', `Session exited (code ${code})`)
      this.send(IPC_CHANNELS.sessionExit, { id, code })
    })
    transport.on('error', (err: Error) => {
      this.appendLog(id, 'error', err.message)
      this.updateStatus(id, 'error', err.message)
    })
  }

  open(request: OpenSessionRequest, cols = 80, rows = 24): SessionInfo {
    const id = nanoid()
    const info: SessionInfo = {
      id,
      protocol: request.protocol ?? 'local_pty',
      title: request.title ?? 'Terminal',
      status: 'connecting',
      hostId: request.hostId ?? null,
      profileId: request.profileId ?? null
    }

    this.sessions.set(id, {
      info,
      transport: null,
      reconnectMeta: { ...request, cols, rows },
      connecting: true
    })

    if (request.hostId) {
      const host = hostRepository.getHost(request.hostId)
      if (host) connectionLog.setSessionVerbosity(id, host.logVerbosity)
    } else {
      connectionLog.setSessionVerbosity(id, 'info')
    }

    this.appendLog(id, 'info', 'Session requested')
    void this.connectInBackground(id, request, cols, rows)
    return info
  }

  private async connectInBackground(
    id: string,
    request: OpenSessionRequest,
    cols: number,
    rows: number
  ): Promise<void> {
    const managed = this.sessions.get(id)
    if (!managed) return

    try {
      const result = await sessionFactory.createTransport(id, request, cols, rows)
      if (!this.sessions.has(id)) return

      managed.transport = result.transport
      managed.rdpProxy = result.rdpProxy
      managed.vncProxy = result.vncProxy
      managed.info.protocol = result.protocol
      managed.info.title = result.title
      managed.info.proxyUrl = result.proxyUrl
      managed.info.status = 'connected'
      managed.connecting = false

      this.appendLog(id, 'info', 'Session connected')

      if (isTerminalProtocol(result.protocol)) {
        this.attachTransport(id, result.transport)
      }
      this.updateStatus(id, 'connected')
      this.updateSessionWindowTitle(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.appendLog(id, 'error', message)
      this.updateStatus(id, 'error', message)
    }
  }

  async reconnect(sessionId: string): Promise<SessionInfo | null> {
    const existing = this.sessions.get(sessionId)
    if (!existing?.reconnectMeta) return null

    const { cols, rows, ...request } = existing.reconnectMeta
    existing.transport?.disconnect()
    existing.rdpProxy?.stop()
    existing.vncProxy?.stop()
    existing.transport = null
    existing.rdpProxy = undefined
    existing.vncProxy = undefined

    connectionLog.clear(sessionId)
    if (request.hostId) {
      const host = hostRepository.getHost(request.hostId)
      if (host) connectionLog.setSessionVerbosity(sessionId, host.logVerbosity)
    }
    this.updateStatus(sessionId, 'connecting')
    this.appendLog(sessionId, 'info', 'Reconnecting…')

    try {
      const result = await sessionFactory.createTransport(sessionId, request, cols, rows)
      existing.transport = result.transport
      existing.rdpProxy = result.rdpProxy
      existing.vncProxy = result.vncProxy
      existing.info.protocol = result.protocol
      existing.info.title = result.title
      existing.info.proxyUrl = result.proxyUrl
      existing.info.status = 'connected'
      existing.connecting = false

      if (isTerminalProtocol(result.protocol)) {
        this.attachTransport(sessionId, result.transport)
      }
      this.updateStatus(sessionId, 'connected')
      this.updateSessionWindowTitle(sessionId)
      return existing.info
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.appendLog(sessionId, 'error', message)
      this.updateStatus(sessionId, 'error', message)
      return existing.info
    }
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.transport?.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    session?.transport?.resize(cols, rows)
    if (session?.reconnectMeta) {
      session.reconnectMeta.cols = cols
      session.reconnectMeta.rows = rows
    }
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.transport?.disconnect()
    session.rdpProxy?.stop()
    session.vncProxy?.stop()
    connectionLog.removeSession(sessionId)
    this.sessions.delete(sessionId)
    this.send(IPC_CHANNELS.sessionExit, { id: sessionId, code: 0 })

    const sessionWin = this.sessionWindows.get(sessionId)
    if (sessionWin && !sessionWin.isDestroyed()) {
      sessionWin.removeAllListeners('closed')
      sessionWin.close()
    }
    this.sessionWindows.delete(sessionId)
  }

  closeAll(): void {
    for (const id of this.sessions.keys()) {
      this.close(id)
    }
  }

  getLogEntries(sessionId: string) {
    return connectionLog.getEntries(sessionId)
  }

  appendSessionLog(
    sessionId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    this.appendLog(sessionId, level, message)
  }

  appendOperationLog(
    logId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const entry = connectionLog.append(logId, level, message, meta)
    if (entry) this.send(IPC_CHANNELS.sessionLog, entry)
  }

  setLogWindow(win: BrowserWindow | null): void {
    this.logWindow = win
  }

  async getCredentialsForRdp(profileId: string): Promise<{ username: string; password: string } | null> {
    const profile = hostRepository.getProfile(profileId)
    if (!profile) return null
    const password = profile.credentialRef ? await credentialVault.retrieve(profile.credentialRef) : null
    return { username: profile.username ?? '', password: password ?? '' }
  }

  async getCredentialsForVnc(profileId: string): Promise<string | null> {
    const profile = hostRepository.getProfile(profileId)
    if (!profile?.credentialRef) return null
    return credentialVault.retrieve(profile.credentialRef)
  }
}

export const sessionManager = new SessionManager()
