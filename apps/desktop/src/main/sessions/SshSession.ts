import net from 'node:net'
import { Client, type ConnectConfig } from 'ssh2'
import { defaultPortForProtocol, resolveRemoteShellInvoke, sshDebugEnabled } from '@consoleri/core'
import type { ShellPromptMode } from '@consoleri/core'
import type { ConnectionProfile, Host } from '../../shared/types'
import type { ResolvedCredentials } from '../services/CredentialResolver'
import { BaseTransport } from './Transport'
import type { ConnectionLog } from './ConnectionLog'

export interface SshConnectOptions {
  host: Host
  profile: ConnectionProfile
  credentials: ResolvedCredentials
  jumpHost?: Host | null
  jumpCredentials?: ResolvedCredentials | null
  cols: number
  rows: number
  log: ConnectionLog
  sessionId: string
  shellPrompt?: ShellPromptMode
}

interface ConnectConfigOptions {
  portOverride?: number
  log: ConnectionLog
  sessionId: string
  host: Host
}

function toConnectConfig(
  host: Host,
  credentials: ResolvedCredentials,
  options: ConnectConfigOptions
): ConnectConfig {
  const config: ConnectConfig = {
    host: host.hostname,
    port: options.portOverride ?? (host.port || defaultPortForProtocol('ssh')),
    username: credentials.username || 'root',
    password: credentials.password,
    privateKey: credentials.privateKey,
    passphrase: credentials.passphrase,
    readyTimeout: 20000,
    keepaliveInterval: 10000
  }

  if (sshDebugEnabled(host.logVerbosity)) {
    config.debug = (message) => {
      options.log.append(options.sessionId, 'debug', message, { source: 'ssh2' })
    }
  }

  return config
}

interface SocketLogContext {
  log: ConnectionLog
  sessionId: string
  label: string
}

function createNoDelaySocket(host: string, port: number, logCtx?: SocketLogContext): net.Socket {
  const sock = net.connect({ host, port })
  sock.setNoDelay(true)

  if (logCtx) {
    const { log, sessionId, label } = logCtx
    const tag = `[tcp:${label}]`
    const meta = { source: 'socket' }
    log.append(sessionId, 'debug', `${tag} Connecting TCP to ${host}:${port}`, meta)
    sock.on('lookup', (err, address, family) => {
      if (err) {
        log.append(sessionId, 'debug', `${tag} DNS lookup failed for ${host}: ${err.message}`, meta)
      } else {
        log.append(sessionId, 'debug', `${tag} Resolved ${host} -> ${address} (IPv${family})`, meta)
      }
    })
    sock.on('connect', () => {
      log.append(sessionId, 'debug', `${tag} TCP connected to ${host}:${port}`, meta)
    })
    sock.on('timeout', () => {
      log.append(sessionId, 'debug', `${tag} TCP socket timeout`, meta)
    })
    sock.on('error', (err) => {
      log.append(sessionId, 'debug', `${tag} TCP socket error: ${err.message}`, meta)
    })
    sock.on('close', (hadError) => {
      log.append(sessionId, 'debug', `${tag} TCP socket closed${hadError ? ' (with error)' : ''}`, meta)
    })
  }

  return sock
}

function connectWithJump(
  bastionConfig: ConnectConfig,
  targetConfig: ConnectConfig,
  log: ConnectionLog,
  sessionId: string
): Promise<Client> {
  return new Promise((resolve, reject) => {
    const bastion = new Client()
    log.append(sessionId, 'info', `Connecting to jump host ${bastionConfig.host}:${bastionConfig.port}`)
    bastion
      .on('ready', () => {
        log.append(sessionId, 'info', 'Jump host ready, forwarding to target')
        bastion.forwardOut(
          '127.0.0.1',
          0,
          targetConfig.host!,
          targetConfig.port ?? 22,
          (err, stream) => {
            if (err) {
              bastion.end()
              log.append(sessionId, 'error', `Jump forward failed: ${err.message}`)
              reject(err)
              return
            }
            const target = new Client()
            target
              .on('ready', () => {
                log.append(sessionId, 'info', 'Target SSH session ready via jump host')
                resolve(target)
              })
              .on('error', (e) => {
                bastion.end()
                log.append(sessionId, 'error', `Target connection failed: ${e.message}`)
                reject(e)
              })
            target.connect({ ...targetConfig, sock: stream })
          }
        )
      })
      .on('error', (err) => {
        log.append(sessionId, 'error', `Jump host error: ${err.message}`)
        reject(err)
      })
      .connect({
        ...bastionConfig,
        sock: createNoDelaySocket(bastionConfig.host!, bastionConfig.port ?? 22, {
          log,
          sessionId,
          label: 'jump'
        })
      })
  })
}

export class SshSession extends BaseTransport {
  readonly protocol = 'ssh'
  private client: Client | null = null
  private stream: import('ssh2').ClientChannel | null = null

  static async create(options: SshConnectOptions): Promise<SshSession> {
    const session = new SshSession()
    await session.connect(options)
    return session
  }

  private async connect(options: SshConnectOptions): Promise<void> {
    const {
      host,
      profile,
      credentials,
      jumpHost,
      jumpCredentials,
      cols,
      rows,
      log,
      sessionId,
      shellPrompt = 'consoleri'
    } = options

    log.append(sessionId, 'info', `Connecting SSH to ${host.hostname}:${host.port || 22}`)
    log.append(sessionId, 'debug', `Profile: ${profile.name}, user: ${credentials.username}`)

    const connectOptions = { log, sessionId, host }
    const targetConfig = toConnectConfig(host, credentials, connectOptions)

    if (profile.jumpHostId && jumpHost) {
      if (!jumpCredentials) {
        throw new Error('Jump host credentials could not be resolved')
      }
      const bastionConfig = toConnectConfig(jumpHost, jumpCredentials, connectOptions)
      this.client = await connectWithJump(bastionConfig, targetConfig, log, sessionId)
    } else {
      this.client = await new Promise<Client>((resolve, reject) => {
        const c = new Client()
        c.on('ready', () => {
          log.append(sessionId, 'info', 'SSH handshake complete')
          resolve(c)
        })
        c.on('error', (err) => {
          log.append(sessionId, 'error', `SSH error: ${err.message}`)
          reject(err)
        })
        c.connect({
          ...targetConfig,
          sock: createNoDelaySocket(targetConfig.host!, targetConfig.port ?? 22, {
            log,
            sessionId,
            label: 'target'
          })
        })
      })
    }

    const shellInvoke = resolveRemoteShellInvoke(profile.shell, {
      promptFallback: shellPrompt === 'consoleri'
    })
    log.append(
      sessionId,
      'info',
      shellInvoke.mode === 'default'
        ? 'Opening interactive shell'
        : `Opening shell: ${shellInvoke.command}`
    )

    const pty = { rows, cols, term: 'xterm-256color' as const }
    const stream = await new Promise<import('ssh2').ClientChannel>((resolve, reject) => {
      if (shellInvoke.mode === 'exec') {
        this.client!.exec(shellInvoke.command, { pty }, (err, s) => {
          if (err) reject(err)
          else resolve(s)
        })
      } else {
        this.client!.shell(pty, (err, s) => {
          if (err) reject(err)
          else resolve(s)
        })
      }
    })

    this.stream = stream
    log.append(sessionId, 'info', 'Shell channel open')
    stream.on('data', (data: Buffer) => this.emit('data', data.toString('utf8')))
    stream.on('close', (code: number) => this.emit('exit', code ?? 0))
    stream.stderr?.on('data', (data: Buffer) => this.emit('data', data.toString('utf8')))
  }

  write(data: string): void {
    this.stream?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.stream?.setWindow(rows, cols, 0, 0)
  }

  disconnect(): void {
    this.stream?.close()
    this.client?.end()
    this.stream = null
    this.client = null
  }
}
