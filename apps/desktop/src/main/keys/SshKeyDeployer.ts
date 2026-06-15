import { Client } from 'ssh2'
import { existsSync, readFileSync } from 'fs'
import { nanoid } from 'nanoid'
import {
  buildAuthorizedKeysInstallCommand,
  defaultPortForProtocol,
  publicKeyPathForPrivate
} from '@consoleri/core'
import type { DeployKeyRequest, DeployKeyResult } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { sessionManager } from '../sessions/SessionManager'
import { credentialResolver, findSshProfile } from '../services/CredentialResolver'
import {
  connectSshClient,
  connectSshViaJump,
  toSshConnectConfig
} from '../sessions/SshConnectHelper'

const EXEC_TIMEOUT_MS = 30_000

function execCommand(
  client: Client,
  command: string
): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    let stdout = ''
    const timer = setTimeout(() => {
      reject(new Error(`Remote command timed out after ${EXEC_TIMEOUT_MS / 1000}s`))
    }, EXEC_TIMEOUT_MS)

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

function readPublicKeyLine(keyPath: string): string {
  const pubPath = keyPath.endsWith('.pub') ? keyPath : publicKeyPathForPrivate(keyPath)
  if (!existsSync(pubPath)) {
    throw new Error(`Public key not found: ${pubPath}`)
  }
  const content = readFileSync(pubPath, 'utf8')
  const line = content.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'))
  if (!line) throw new Error(`Invalid public key file: ${pubPath}`)
  return line.trim()
}

type LogFn = (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void

export class SshKeyDeployer {
  async deploy(request: DeployKeyRequest): Promise<DeployKeyResult> {
    const logId = request.logId ?? nanoid()
    const log: LogFn = (level, message) => sessionManager.appendOperationLog(logId, level, message)

    const host = hostRepository.getHost(request.hostId)
    if (!host) {
      log('error', 'Host not found')
      return { success: false, message: 'Host not found', logId }
    }

    const profiles = hostRepository.listProfiles(host.id).filter((p) => p.protocol === 'ssh')
    const profile = request.profileId
      ? profiles.find((p) => p.id === request.profileId) ?? null
      : findSshProfile(profiles, null)

    if (!profile) {
      log('error', 'No SSH profile found for this host')
      return { success: false, message: 'No SSH profile found for this host', logId }
    }

    log('info', `Deploying public key to ${host.name} (${host.hostname}:${host.port || 22})`)
    log('debug', `Profile: ${profile.name}, user: ${profile.username ?? '(default)'}`)

    let credentials = await credentialResolver.resolveForProfile(profile)
    if (request.deployPassword) {
      credentials = { ...credentials, password: request.deployPassword, privateKey: undefined }
      log('debug', 'Using password from deploy dialog')
    }

    if (!credentials.password && !credentials.privateKey) {
      const message = 'No credentials available. Provide a password to connect for deployment.'
      log('error', message)
      return { success: false, message, logId }
    }

    let pubkeyLine: string
    try {
      pubkeyLine = readPublicKeyLine(request.keyPath)
      log('info', `Public key loaded from ${request.keyPath}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log('error', message)
      return { success: false, message, logId }
    }

    const targetConfig = toSshConnectConfig(
      host.hostname,
      host.port || defaultPortForProtocol('ssh'),
      credentials
    )

    let client: Client
    try {
      if (profile.jumpHostId) {
        log('info', 'Connecting via jump host…')
        const jumpHost = hostRepository.getHost(profile.jumpHostId)
        if (!jumpHost) {
          log('error', 'Jump host not found')
          return { success: false, message: 'Jump host not found', logId }
        }
        const jumpProfiles = hostRepository.listProfiles(profile.jumpHostId)
        const jumpProfile = findSshProfile(jumpProfiles, null)
        if (!jumpProfile) {
          log('error', 'Jump host has no SSH profile')
          return { success: false, message: 'Jump host has no SSH profile', logId }
        }
        const jumpCredentials = await credentialResolver.resolveForProfile(jumpProfile)
        const bastionConfig = toSshConnectConfig(
          jumpHost.hostname,
          jumpHost.port || defaultPortForProtocol('ssh'),
          jumpCredentials
        )
        client = await connectSshViaJump(bastionConfig, targetConfig)
      } else {
        log('info', 'Connecting via SSH…')
        client = await connectSshClient(targetConfig)
      }
      log('info', 'SSH connection established')
    } catch (e) {
      const message = `SSH connection failed: ${e instanceof Error ? e.message : String(e)}`
      log('error', message)
      return { success: false, message, logId }
    }

    try {
      const command = buildAuthorizedKeysInstallCommand(pubkeyLine)
      log('debug', 'Running authorized_keys install command')
      const { code, stderr, stdout } = await execCommand(client, command)
      if (stdout.trim()) log('debug', `stdout: ${stdout.trim()}`)
      if (stderr.trim()) log('warn', `stderr: ${stderr.trim()}`)

      if (code !== 0) {
        const message = stderr.trim() || `Remote command exited with code ${code}`
        log('error', message)
        return { success: false, message, logId }
      }

      const message = 'Public key deployed to ~/.ssh/authorized_keys'
      log('info', message)
      return { success: true, message, logId }
    } catch (e) {
      const message = `Deploy failed: ${e instanceof Error ? e.message : String(e)}`
      log('error', message)
      return { success: false, message, logId }
    } finally {
      client.end()
      log('debug', 'SSH connection closed')
    }
  }
}

export const sshKeyDeployer = new SshKeyDeployer()
