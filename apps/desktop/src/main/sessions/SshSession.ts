import { Client, type ConnectConfig } from 'ssh2'
import type { Host } from '../../shared/types'
import { credentialVault } from '../hosts/CredentialVault'
import { hostRepository } from '../hosts/HostRepository'
import { BaseTransport } from './Transport'

export interface SshConnectOptions {
  host: Host
  username: string
  password?: string
  privateKey?: string
  shell?: string
  jumpHostId?: string | null
  cols: number
  rows: number
}

async function buildConnectConfig(
  host: Host,
  username: string,
  credentialRef: string | null
): Promise<ConnectConfig> {
  const config: ConnectConfig = {
    host: host.hostname,
    port: host.port || 22,
    username,
    readyTimeout: 20000,
    keepaliveInterval: 10000
  }

  if (credentialRef) {
    const secret = await credentialVault.retrieve(credentialRef)
    if (secret) {
      if (credentialRef.includes(':key')) {
        config.privateKey = secret
      } else {
        config.password = secret
      }
    }
  }

  return config
}

function connectWithJump(
  bastionConfig: ConnectConfig,
  targetConfig: ConnectConfig
): Promise<Client> {
  return new Promise((resolve, reject) => {
    const bastion = new Client()
    bastion
      .on('ready', () => {
        bastion.forwardOut(
          '127.0.0.1',
          0,
          targetConfig.host!,
          targetConfig.port ?? 22,
          (err, stream) => {
            if (err) {
              bastion.end()
              reject(err)
              return
            }
            const target = new Client()
            target
              .on('ready', () => resolve(target))
              .on('error', (e) => {
                bastion.end()
                reject(e)
              })
            target.connect({
              ...targetConfig,
              sock: stream
            })
          }
        )
      })
      .on('error', reject)
      .connect(bastionConfig)
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
    const { host, username, shell, jumpHostId, cols, rows } = options
    let password = options.password
    let privateKey = options.privateKey

    const profile = hostRepository.listProfiles(host.id).find((p) => p.protocol === 'ssh')
    const credRef = profile?.credentialRef
    if (credRef && !password && !privateKey) {
      const secret = await credentialVault.retrieve(credRef)
      if (secret) {
        if (credRef.includes(':key')) privateKey = secret
        else password = secret
      }
    }

    const targetConfig: ConnectConfig = {
      host: host.hostname,
      port: host.port || 22,
      username,
      password,
      privateKey,
      readyTimeout: 20000,
      keepaliveInterval: 10000
    }

    if (jumpHostId) {
      const jumpHost = hostRepository.getHost(jumpHostId)
      if (!jumpHost) throw new Error(`Jump host not found: ${jumpHostId}`)
      const jumpProfile = hostRepository.listProfiles(jumpHostId)[0]
      const bastionConfig = await buildConnectConfig(
        jumpHost,
        jumpProfile?.username ?? username,
        jumpProfile?.credentialRef ?? null
      )
      this.client = await connectWithJump(bastionConfig, targetConfig)
    } else {
      this.client = await new Promise<Client>((resolve, reject) => {
        const c = new Client()
        c.on('ready', () => resolve(c))
        c.on('error', reject)
        c.connect(targetConfig)
      })
    }

    const shellCmd = shell || undefined
    const stream = await new Promise<import('ssh2').ClientChannel>((resolve, reject) => {
      if (shellCmd) {
        this.client!.exec(shellCmd, { pty: { rows, cols, term: 'xterm-256color' } }, (err, s) => {
          if (err) reject(err)
          else resolve(s)
        })
      } else {
        this.client!.shell({ rows, cols, term: 'xterm-256color' }, (err, s) => {
          if (err) reject(err)
          else resolve(s)
        })
      }
    })

    this.stream = stream
    stream.on('data', (data: Buffer) => this.emit('data', data.toString('utf8')))
    stream.on('close', () => this.emit('exit', 0))
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
