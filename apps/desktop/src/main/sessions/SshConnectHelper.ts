import { Client, type ConnectConfig } from 'ssh2'
import type { ResolvedCredentials } from '../services/CredentialResolver'

export const SSH_CONNECT_TIMEOUT_MS = 20_000
export const SSH_EXEC_TIMEOUT_MS = 30_000

export interface SshExecResult {
  code: number
  stderr: string
  stdout: string
}

export function execSshCommand(
  client: Client,
  command: string,
  timeoutMs: number = SSH_EXEC_TIMEOUT_MS
): Promise<SshExecResult> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    let stdout = ''
    const timer = setTimeout(() => {
      reject(new Error(`Remote command timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer)
        reject(err)
        return
      }

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf8')
      })
      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf8')
      })
      stream.on('close', (code: number) => {
        clearTimeout(timer)
        resolve({ code: code ?? 0, stderr, stdout })
      })
    })
  })
}

export function toSshConnectConfig(
  hostname: string,
  port: number,
  credentials: ResolvedCredentials
): ConnectConfig {
  return {
    host: hostname,
    port,
    username: credentials.username || 'root',
    password: credentials.password,
    privateKey: credentials.privateKey,
    passphrase: credentials.passphrase,
    readyTimeout: SSH_CONNECT_TIMEOUT_MS
  }
}

export function connectSshClient(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    const timer = setTimeout(() => {
      client.end()
      reject(new Error(`SSH connection timed out after ${SSH_CONNECT_TIMEOUT_MS / 1000}s`))
    }, SSH_CONNECT_TIMEOUT_MS + 2000)

    client
      .on('ready', () => {
        clearTimeout(timer)
        resolve(client)
      })
      .on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      .connect(config)
  })
}

export async function connectSshViaJump(
  bastionConfig: ConnectConfig,
  targetConfig: ConnectConfig
): Promise<Client> {
  const bastion = await connectSshClient(bastionConfig)
  return new Promise((resolve, reject) => {
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
        const timer = setTimeout(() => {
          bastion.end()
          target.end()
          reject(
            new Error(
              `SSH connection via jump host timed out after ${SSH_CONNECT_TIMEOUT_MS / 1000}s`
            )
          )
        }, SSH_CONNECT_TIMEOUT_MS + 2000)

        target
          .on('ready', () => {
            clearTimeout(timer)
            resolve(target)
          })
          .on('error', (e) => {
            clearTimeout(timer)
            bastion.end()
            reject(e)
          })
        target.connect({ ...targetConfig, sock: stream })
      }
    )
  })
}
