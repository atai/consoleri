import { defaultPortForProtocol, shellEscapeSingleQuoted } from '@consoleri/core'
import type { ReportHostStatus } from '@consoleri/core'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { hostRepository } from '../hosts/HostRepository'
import { profileRepository } from '../hosts/ProfileRepository'
import {
  credentialResolver,
  findSshProfile,
  type ResolvedCredentials
} from '../services/CredentialResolver'
import { connectSshClient, execSshCommand, toSshConnectConfig } from '../sessions/SshConnectHelper'
import { resolveReportHostProfile } from './resolveReportHostProfile'

const execFileAsync = promisify(execFile)

export const PING_TIMEOUT_MS = 3000

export type PingTargetResult = {
  status: ReportHostStatus
  durationMs: number
  error?: string
  log: string[]
}

export function buildLocalPingArgs(hostname: string): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: 'ping', args: ['-n', '1', '-w', String(PING_TIMEOUT_MS), hostname] }
  }
  if (process.platform === 'darwin') {
    return { file: 'ping', args: ['-c', '1', '-W', String(PING_TIMEOUT_MS), hostname] }
  }
  return {
    file: 'ping',
    args: ['-c', '1', '-W', String(Math.ceil(PING_TIMEOUT_MS / 1000)), hostname]
  }
}

export function buildRemotePingCommand(hostname: string): string {
  return `ping -c 1 -W 3 ${shellEscapeSingleQuoted(hostname)}`
}

async function localPing(hostname: string): Promise<PingTargetResult> {
  const started = Date.now()
  const log: string[] = [`Ping target: ${hostname}`]
  const { file, args } = buildLocalPingArgs(hostname)

  try {
    const { stdout } = await execFileAsync(file, args, {
      timeout: PING_TIMEOUT_MS + 2000,
      windowsHide: true
    })
    const output = stdout.trim()
    if (output) log.push(output.split('\n')[0] ?? output)
    log.push('Ping successful')
    return { status: 'ok', durationMs: Date.now() - started, log }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.push(`Ping failed: ${message}`)
    return {
      status: 'fail',
      durationMs: Date.now() - started,
      error: message,
      log
    }
  }
}

async function connectJumpHost(
  jumpHostId: string
): Promise<
  | { ok: true; credentials: ResolvedCredentials; jumpHostname: string; log: string[] }
  | { ok: false; error: string; log: string[] }
> {
  const log: string[] = []
  const jumpHost = hostRepository.getHost(jumpHostId)
  if (!jumpHost) {
    const error = 'Jump host not found'
    log.push(error)
    return { ok: false, error, log }
  }

  const jumpProfiles = profileRepository.listProfiles(jumpHostId)
  const jumpProfile = findSshProfile(jumpProfiles, null)
  if (!jumpProfile) {
    const error = 'Jump host has no SSH profile'
    log.push(error)
    return { ok: false, error, log }
  }

  let credentials: ResolvedCredentials
  try {
    credentials = await credentialResolver.resolveForProfile(jumpProfile)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.push(`Jump host credential error: ${message}`)
    return { ok: false, error: message, log }
  }

  if (!credentials.password && !credentials.privateKey) {
    const error = 'No credentials available for jump host'
    log.push(error)
    return { ok: false, error, log }
  }

  log.push(`Jump host: ${jumpHost.hostname}`)
  return { ok: true, credentials, jumpHostname: jumpHost.hostname, log }
}

async function remotePingViaJump(jumpHostId: string, hostname: string): Promise<PingTargetResult> {
  const started = Date.now()
  const log: string[] = [`Ping target: ${hostname}`]

  const jump = await connectJumpHost(jumpHostId)
  log.push(...jump.log)
  if (!jump.ok) {
    return {
      status: 'fail',
      durationMs: Date.now() - started,
      error: jump.error,
      log
    }
  }

  const jumpHost = hostRepository.getHost(jumpHostId)!
  const jumpPort = jumpHost.port || defaultPortForProtocol('ssh')
  const bastionConfig = toSshConnectConfig(jump.jumpHostname, jumpPort, jump.credentials)

  let client
  try {
    log.push(`Connecting to jump host ${jump.jumpHostname}…`)
    client = await connectSshClient(bastionConfig)
    const command = buildRemotePingCommand(hostname)
    log.push(`Running: ${command}`)
    const { code, stderr, stdout } = await execSshCommand(client, command, PING_TIMEOUT_MS + 2000)
    if (stdout.trim()) log.push(stdout.trim().split('\n')[0] ?? stdout.trim())
    if (code === 0) {
      log.push('Ping successful')
      return { status: 'ok', durationMs: Date.now() - started, log }
    }
    const error = stderr.trim() || `Remote ping exited with code ${code}`
    log.push(`Ping failed: ${error}`)
    return {
      status: 'fail',
      durationMs: Date.now() - started,
      error,
      log
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.push(`Ping failed: ${message}`)
    return {
      status: 'fail',
      durationMs: Date.now() - started,
      error: message,
      log
    }
  } finally {
    client?.end()
  }
}

export async function pingTarget(hostId: string, profileId: string): Promise<PingTargetResult> {
  const started = Date.now()
  const resolved = resolveReportHostProfile(hostId, profileId)
  if (!resolved.ok) {
    return {
      status: 'fail',
      durationMs: Date.now() - started,
      error: resolved.error,
      log: resolved.log
    }
  }

  const { host, profile } = resolved
  if (profile.jumpHostId) {
    return remotePingViaJump(profile.jumpHostId, host.hostname)
  }

  return localPing(host.hostname)
}
