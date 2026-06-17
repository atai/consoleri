import { buildRdpDestination, defaultPortForProtocol, resolveRdpPort } from '@consoleri/core'
import type { ConnectionProfile, Host, OpenSessionRequest, Protocol } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import {
  credentialResolver,
  findSshProfile,
  resolveHostAndProfile
} from '../services/CredentialResolver'
import { connectionLog, type ConnectionLog } from './ConnectionLog'
import { PtySession } from './PtySession'
import { RdpProxy, RdpSession } from './rdp/RdpProxy'
import { SshSession } from './SshSession'
import type { ITransport } from './Transport'
import { VncProxy, VncSession } from './VncProxy'

export interface SessionTransportResult {
  transport: ITransport
  protocol: Protocol
  title: string
  proxyUrl?: string
  rdpDestination?: string
  rdpProxy?: RdpProxy
  vncProxy?: VncProxy
}

export class SessionFactory {
  constructor(private readonly log: ConnectionLog = connectionLog) {}

  resolveContext(request: OpenSessionRequest): {
    host: Host | null
    profile: ConnectionProfile | null
    protocol: Protocol
    title: string
  } {
    const { host, profile } = resolveHostAndProfile(
      request.hostId,
      request.profileId,
      (id) => hostRepository.getHost(id),
      (id) => hostRepository.listProfiles(id)
    )

    let protocol: Protocol = request.protocol ?? profile?.protocol ?? 'local_pty'
    let title = request.title ?? 'Terminal'

    if (profile) protocol = profile.protocol
    if (host) title = `${host.name} (${protocol})`

    if (request.hostId && !profile && !request.localShell) {
      throw new Error('No connection profile configured for this host')
    }

    if (host && protocol === 'ssh' && !profile) {
      throw new Error('SSH requires a connection profile with credentials')
    }

    return { host, profile, protocol, title }
  }

  async createTransport(
    sessionId: string,
    request: OpenSessionRequest,
    cols: number,
    rows: number
  ): Promise<SessionTransportResult> {
    const { host, profile, protocol, title } = this.resolveContext(request)
    if (host) {
      this.log.setSessionVerbosity(sessionId, host.logVerbosity)
    } else {
      this.log.setSessionVerbosity(sessionId, 'info')
    }
    this.log.append(sessionId, 'info', `Starting ${protocol} session: ${title}`)

    if (!request.hostId && !request.profileId) {
      const shell = request.localShell ?? (process.platform === 'win32' ? 'powershell' : 'bash')
      const localProtocol: Protocol = shell === 'wsl' ? 'wsl' : 'local_pty'
      const localTitle =
        shell === 'wsl' ? `WSL${request.wslDistro ? ` (${request.wslDistro})` : ''}` : shell
      this.log.append(sessionId, 'info', `Spawning local shell: ${shell}`)
      return {
        transport: new PtySession(shell, cols, rows, request.wslDistro),
        protocol: localProtocol,
        title: localTitle
      }
    }

    if (!host) throw new Error('Host not found')

    switch (protocol) {
      case 'ssh': {
        if (!profile) throw new Error('SSH profile required')
        const credentials = await credentialResolver.resolveForProfile(profile)
        let jumpHost: Host | null = null
        let jumpCredentials: Awaited<ReturnType<typeof credentialResolver.resolveForProfile>> | null =
          null
        if (profile.jumpHostId) {
          jumpHost = hostRepository.getHost(profile.jumpHostId)
          if (!jumpHost) throw new Error(`Jump host not found: ${profile.jumpHostId}`)
          const jumpProfiles = hostRepository.listProfiles(profile.jumpHostId)
          const jumpProfile = findSshProfile(jumpProfiles, null)
          if (!jumpProfile) throw new Error('Jump host has no SSH profile')
          jumpCredentials = await credentialResolver.resolveForProfile(jumpProfile)
        }
        const transport = await SshSession.create({
          host,
          profile,
          credentials,
          jumpHost,
          jumpCredentials,
          cols,
          rows,
          log: this.log,
          sessionId
        })
        return { transport, protocol, title }
      }
      case 'rdp': {
        const rdpProxy = new RdpProxy()
        const rdpPort = resolveRdpPort(profile?.extra)
        const rdpDestination = buildRdpDestination(host.hostname, rdpPort)
        this.log.append(sessionId, 'info', `Starting RDP proxy → ${rdpDestination}`)
        const proxy = await rdpProxy.start(host.hostname, rdpPort, (level, message) => {
          this.log.append(sessionId, level, message)
        })
        return {
          transport: new RdpSession(proxy.proxyUrl, rdpProxy),
          protocol,
          title,
          proxyUrl: proxy.proxyUrl,
          rdpDestination,
          rdpProxy
        }
      }
      case 'vnc': {
        const vncProxy = new VncProxy()
        const vncPort = (profile?.extra?.vncPort as number) ?? defaultPortForProtocol('vnc')
        this.log.append(sessionId, 'info', `Starting VNC proxy → ${host.hostname}:${vncPort}`)
        const proxy = await vncProxy.start(host.hostname, vncPort)
        return {
          transport: new VncSession(proxy.proxyUrl, vncProxy),
          protocol,
          title,
          proxyUrl: proxy.proxyUrl,
          vncProxy
        }
      }
      case 'wsl':
        this.log.append(sessionId, 'info', `Opening WSL${request.wslDistro ? ` (${request.wslDistro})` : ''}`)
        return {
          transport: new PtySession('wsl', cols, rows, request.wslDistro, profile?.shell ?? '/bin/bash'),
          protocol: 'wsl',
          title
        }
      case 'local_pty':
      default: {
        const shell = request.localShell ?? 'powershell'
        this.log.append(sessionId, 'info', `Opening local shell: ${shell}`)
        return {
          transport: new PtySession(shell, cols, rows),
          protocol: 'local_pty',
          title
        }
      }
    }
  }
}

export const sessionFactory = new SessionFactory()
