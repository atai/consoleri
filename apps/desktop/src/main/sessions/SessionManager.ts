import { nanoid } from 'nanoid'
import type { BrowserWindow } from 'electron'
import { isTerminalProtocol } from '@consoleri/core'
import type { OpenSessionRequest, Protocol, SessionInfo, SessionStatus } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { profileRepository } from '../hosts/ProfileRepository'
import { credentialResolver } from '../services/CredentialResolver'
import { connectionLog } from './ConnectionLog'
import { sessionFactory } from './SessionFactory'
import type { ITransport } from './Transport'
import { RdpProxy } from './rdp/RdpProxy'
import { VncProxy } from './VncProxy'
import { formatSessionWindowTitle } from '../windowTitles'
import { getRegisteredSessionWindow } from '../windows/SessionWindowRegistry'

interface ManagedSession {
  info: SessionInfo
  transport: ITransport | null
  rdpProxy?: RdpProxy
  vncProxy?: VncProxy
  reconnectMeta?: OpenSessionRequest & { cols: number; rows: number }
  connecting?: boolean
}

interface TransportResult {
  transport: ITransport
  rdpProxy?: RdpProxy
  vncProxy?: VncProxy
  protocol: Protocol
  title: string
  proxyUrl?: string
  rdpDestination?: string
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>()
  private window: BrowserWindow | null = null
  private logWindow: BrowserWindow | null = null

  constructor(
    private readonly _hostRepository = hostRepository,
    private readonly _profileRepository = profileRepository,
    private readonly _credentialResolver = credentialResolver,
    private readonly _connectionLog = connectionLog,
    private readonly _sessionFactory = sessionFactory
  ) {}

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
      const sessionWin = getRegisteredSessionWindow(sessionId)
      if (sessionWin) {
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

  private updateSessionWindowTitle(sessionId: string): void {
    const win = getRegisteredSessionWindow(sessionId)
    const session = this.sessions.get(sessionId)
    if (win && session) {
      win.setTitle(formatSessionWindowTitle(session.info))
    }
  }

  private appendLog(sessionId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const entry = this._connectionLog.append(sessionId, level, message)
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

  private applyTransportResult(managed: ManagedSession, sessionId: string, result: TransportResult): void {
    managed.transport = result.transport
    managed.rdpProxy = result.rdpProxy
    managed.vncProxy = result.vncProxy
    managed.info.protocol = result.protocol
    managed.info.title = result.title
    managed.info.proxyUrl = result.proxyUrl
    managed.info.rdpDestination = result.rdpDestination
    managed.info.status = 'connected'
    managed.connecting = false

    if (isTerminalProtocol(result.protocol)) {
      this.attachTransport(sessionId, result.transport)
    }
    this.updateStatus(sessionId, 'connected')
    this.updateSessionWindowTitle(sessionId)
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
      const host = this._hostRepository.getHost(request.hostId)
      if (host) this._connectionLog.setSessionVerbosity(id, host.logVerbosity)
    } else {
      this._connectionLog.setSessionVerbosity(id, 'info')
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
      const result = await this._sessionFactory.createTransport(id, request, cols, rows)
      if (!this.sessions.has(id)) return
      this.appendLog(id, 'info', 'Session connected')
      this.applyTransportResult(managed, id, result)
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

    this._connectionLog.clear(sessionId)
    if (request.hostId) {
      const host = this._hostRepository.getHost(request.hostId)
      if (host) this._connectionLog.setSessionVerbosity(sessionId, host.logVerbosity)
    }
    this.updateStatus(sessionId, 'connecting')
    this.appendLog(sessionId, 'info', 'Reconnecting…')

    try {
      const result = await this._sessionFactory.createTransport(sessionId, request, cols, rows)
      this.applyTransportResult(existing, sessionId, result)
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
    this._connectionLog.removeSession(sessionId)
    this.sessions.delete(sessionId)
    this.send(IPC_CHANNELS.sessionExit, { id: sessionId, code: 0 })

    const sessionWin = getRegisteredSessionWindow(sessionId)
    if (sessionWin) {
      sessionWin.removeAllListeners('closed')
      sessionWin.close()
    }
  }

  closeAll(): void {
    for (const id of this.sessions.keys()) {
      this.close(id)
    }
  }

  getLogEntries(sessionId: string) {
    return this._connectionLog.getEntries(sessionId)
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
    const entry = this._connectionLog.append(logId, level, message, meta)
    if (entry) this.send(IPC_CHANNELS.sessionLog, entry)
  }

  setLogWindow(win: BrowserWindow | null): void {
    this.logWindow = win
  }

  async getCredentialsForRdp(profileId: string): Promise<{ username: string; password: string } | null> {
    const profile = this._profileRepository.getProfile(profileId)
    if (!profile) return null
    const password = await this._credentialResolver.resolvePassword(profile)
    return { username: profile.username ?? '', password: password ?? '' }
  }

  async getCredentialsForVnc(profileId: string): Promise<string | null> {
    const profile = this._profileRepository.getProfile(profileId)
    if (!profile) return null
    return this._credentialResolver.resolvePassword(profile)
  }
}

export const sessionManager = new SessionManager()
