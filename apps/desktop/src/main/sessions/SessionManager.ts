import { nanoid } from 'nanoid'
import type { BrowserWindow } from 'electron'
import type {
  OpenSessionRequest,
  Protocol,
  SessionInfo,
  SessionStatus
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { credentialVault } from '../hosts/CredentialVault'
import { PtySession } from './PtySession'
import { RdpProxy, RdpSession } from './RdpProxy'
import { SshSession } from './SshSession'
import type { ITransport } from './Transport'
import { VncProxy, VncSession } from './VncProxy'

interface ManagedSession {
  info: SessionInfo
  transport: ITransport | null
  rdpProxy?: RdpProxy
  vncProxy?: VncProxy
  reconnectMeta?: OpenSessionRequest & { cols: number; rows: number }
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>()
  private window: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  private send(channel: string, payload: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  private updateStatus(id: string, status: SessionStatus, error?: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.info.status = status
    if (error) session.info.error = error
    this.send(IPC_CHANNELS.sessionStatus, { id, status, error })
  }

  private attachTransport(id: string, transport: ITransport): void {
    transport.on('data', (data: string) => {
      this.send(IPC_CHANNELS.sessionData, { id, data })
    })
    transport.on('exit', (code: number) => {
      this.updateStatus(id, 'disconnected')
      this.send(IPC_CHANNELS.sessionExit, { id, code })
    })
    transport.on('error', (err: Error) => {
      this.updateStatus(id, 'error', err.message)
    })
  }

  async open(request: OpenSessionRequest, cols = 80, rows = 24): Promise<SessionInfo> {
    const id = nanoid()
    let protocol: Protocol = request.protocol ?? 'local_pty'
    let title = request.title ?? 'Terminal'
    let transport: ITransport | null = null
    let proxyUrl: string | undefined
    let rdpProxy: RdpProxy | undefined
    let vncProxy: VncProxy | undefined

    const info: SessionInfo = {
      id,
      protocol,
      title,
      status: 'connecting',
      hostId: request.hostId ?? null,
      profileId: request.profileId ?? null
    }
    this.sessions.set(id, { info, transport: null, reconnectMeta: { ...request, cols, rows } })

    try {
      if (request.profileId || request.hostId) {
        const profile = request.profileId
          ? hostRepository.getProfile(request.profileId)
          : request.hostId
            ? hostRepository.listProfiles(request.hostId).find((p) => p.id === request.profileId) ??
              hostRepository.listProfiles(request.hostId)[0]
            : null

        const host = request.hostId
          ? hostRepository.getHost(request.hostId)
          : profile?.hostId
            ? hostRepository.getHost(profile.hostId)
            : null

        if (profile) protocol = profile.protocol
        if (host) title = `${host.name} (${protocol})`

        if (protocol === 'ssh' && host) {
          transport = await SshSession.create({
            host,
            username: profile?.username ?? 'root',
            shell: profile?.shell ?? undefined,
            jumpHostId: profile?.jumpHostId,
            cols,
            rows
          })
        } else if (protocol === 'rdp' && host) {
          rdpProxy = new RdpProxy()
          const rdpPort = (profile?.extra?.rdpPort as number) ?? 3389
          const proxy = await rdpProxy.start(host.hostname, rdpPort)
          proxyUrl = proxy.proxyUrl
          transport = new RdpSession(proxy.proxyUrl, rdpProxy)
        } else if (protocol === 'vnc' && host) {
          vncProxy = new VncProxy()
          const vncPort = (profile?.extra?.vncPort as number) ?? 5900
          const proxy = await vncProxy.start(host.hostname, vncPort)
          proxyUrl = proxy.proxyUrl
          transport = new VncSession(proxy.proxyUrl, vncProxy)
        } else if (protocol === 'wsl') {
          transport = new PtySession('wsl', cols, rows, request.wslDistro, profile?.shell ?? '/bin/bash')
        } else if (protocol === 'local_pty') {
          const shell = request.localShell ?? 'powershell'
          transport = new PtySession(shell, cols, rows)
        }
      } else {
        const shell = request.localShell ?? (process.platform === 'win32' ? 'powershell' : 'bash')
        protocol = request.localShell === 'wsl' ? 'wsl' : 'local_pty'
        title = shell === 'wsl' ? `WSL${request.wslDistro ? ` (${request.wslDistro})` : ''}` : shell
        transport = new PtySession(shell, cols, rows, request.wslDistro)
      }

      if (!transport) throw new Error('Failed to create session transport')

      info.protocol = protocol
      info.title = title
      info.proxyUrl = proxyUrl
      info.status = 'connected'

      const managed = this.sessions.get(id)!
      managed.transport = transport
      managed.rdpProxy = rdpProxy
      managed.vncProxy = vncProxy
      managed.info = info

      if (protocol === 'ssh' || protocol === 'local_pty' || protocol === 'wsl') {
        this.attachTransport(id, transport)
      } else {
        this.updateStatus(id, 'connected')
      }

      return info
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.updateStatus(id, 'error', message)
      info.status = 'error'
      info.error = message
      return info
    }
  }

  async reconnect(sessionId: string): Promise<SessionInfo | null> {
    const existing = this.sessions.get(sessionId)
    if (!existing?.reconnectMeta) return null
    this.close(sessionId)
    const newSession = await this.open(existing.reconnectMeta, existing.reconnectMeta.cols, existing.reconnectMeta.rows)
    return newSession
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
    this.sessions.delete(sessionId)
  }

  closeAll(): void {
    for (const id of this.sessions.keys()) {
      this.close(id)
    }
  }

  async getCredentialsForRdp(profileId: string): Promise<{ username: string; password: string } | null> {
    const profile = hostRepository.getProfile(profileId)
    if (!profile) return null
    const password = profile.credentialRef ? await credentialVault.retrieve(profile.credentialRef) : null
    return {
      username: profile.username ?? '',
      password: password ?? ''
    }
  }

  async getCredentialsForVnc(profileId: string): Promise<string | null> {
    const profile = hostRepository.getProfile(profileId)
    if (!profile?.credentialRef) return null
    return credentialVault.retrieve(profile.credentialRef)
  }
}

export const sessionManager = new SessionManager()
