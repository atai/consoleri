import { defaultPortForProtocol } from '@consoleri/core'
import type { Client } from 'ssh2'
import { hostRepository } from '../hosts/HostRepository'
import { profileRepository } from '../hosts/ProfileRepository'
import {
  credentialResolver,
  findSshProfile,
  type ResolvedCredentials
} from '../services/CredentialResolver'
import {
  connectSshClient,
  connectSshViaJump,
  toSshConnectConfig
} from '../sessions/SshConnectHelper'
import { resolveReportHostProfile } from './resolveReportHostProfile'

export type SshReportConnectSuccess = {
  ok: true
  client: Client
  log: string[]
}

export type SshReportConnectFailure = {
  ok: false
  status: 'fail' | 'skipped'
  error: string
  log: string[]
}

export type SshReportConnectResult = SshReportConnectSuccess | SshReportConnectFailure

export class SshReportConnection {
  async connectForProfile(hostId: string, profileId: string): Promise<SshReportConnectResult> {
    const log: string[] = []

    const resolved = resolveReportHostProfile(hostId, profileId)
    if (!resolved.ok) {
      return {
        ok: false,
        status: 'fail',
        error: resolved.error,
        log: resolved.log
      }
    }

    const { host, profile } = resolved

    if (profile.protocol !== 'ssh') {
      return {
        ok: false,
        status: 'skipped',
        error: `Profile protocol is ${profile.protocol}, only SSH is supported`,
        log: [`Skipped: profile protocol is ${profile.protocol}`]
      }
    }

    const port = host.port || defaultPortForProtocol('ssh')
    log.push(`Target: ${host.hostname}:${port}`)
    log.push(`Profile: ${profile.name}`)
    log.push(`User: ${profile.username ?? '(default)'}`)

    let credentials: ResolvedCredentials
    try {
      credentials = await credentialResolver.resolveForProfile(profile)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.push(`Credential error: ${message}`)
      return { ok: false, status: 'fail', error: message, log }
    }

    if (!credentials.password && !credentials.privateKey) {
      const message = 'No credentials available for this profile'
      log.push(message)
      return { ok: false, status: 'fail', error: message, log }
    }

    const targetConfig = toSshConnectConfig(host.hostname, port, credentials)

    try {
      let client: Client
      if (profile.jumpHostId) {
        log.push(`Jump host: ${profile.jumpHostId}`)
        const jumpHost = hostRepository.getHost(profile.jumpHostId)
        if (!jumpHost) {
          throw new Error('Jump host not found')
        }
        const jumpProfiles = profileRepository.listProfiles(profile.jumpHostId)
        const jumpProfile = findSshProfile(jumpProfiles, null)
        if (!jumpProfile) {
          throw new Error('Jump host has no SSH profile')
        }
        const jumpCredentials = await credentialResolver.resolveForProfile(jumpProfile)
        const bastionConfig = toSshConnectConfig(
          jumpHost.hostname,
          jumpHost.port || defaultPortForProtocol('ssh'),
          jumpCredentials
        )
        log.push(`Connecting via jump ${jumpHost.hostname}…`)
        client = await connectSshViaJump(bastionConfig, targetConfig)
      } else {
        log.push('Connecting via SSH…')
        client = await connectSshClient(targetConfig)
      }
      log.push('SSH handshake successful')
      return { ok: true, client, log }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.push(`Connection failed: ${message}`)
      return { ok: false, status: 'fail', error: message, log }
    }
  }
}

export const sshReportConnection = new SshReportConnection()
