import { defaultPortForProtocol } from '@consoleri/core'
import type { ConnectivityTestHostResult } from '@consoleri/core'
import type { Client } from 'ssh2'
import { hostRepository } from '../hosts/HostRepository'
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

export class ConnectivityProbe {
  async probe(hostId: string, profileId: string): Promise<ConnectivityTestHostResult> {
    const started = Date.now()
    const log: string[] = []

    const host = hostRepository.getHost(hostId)
    if (!host) {
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: 'Host not found',
        log: ['Host not found']
      }
    }

    const profiles = hostRepository.listProfiles(host.id)
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) {
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: 'Profile not found for this host',
        log: ['Profile not found for this host']
      }
    }

    if (profile.protocol !== 'ssh') {
      return {
        hostId,
        profileId,
        status: 'skipped',
        durationMs: Date.now() - started,
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
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        log
      }
    }

    if (!credentials.password && !credentials.privateKey) {
      const message = 'No credentials available for this profile'
      log.push(message)
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        log
      }
    }

    const targetConfig = toSshConnectConfig(host.hostname, port, credentials)

    let client: Client
    try {
      if (profile.jumpHostId) {
        log.push(`Jump host: ${profile.jumpHostId}`)
        const jumpHost = hostRepository.getHost(profile.jumpHostId)
        if (!jumpHost) {
          throw new Error('Jump host not found')
        }
        const jumpProfiles = hostRepository.listProfiles(profile.jumpHostId)
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
      client.end()
      return {
        hostId,
        profileId,
        status: 'ok',
        durationMs: Date.now() - started
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.push(`Connection failed: ${message}`)
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        log
      }
    }
  }
}

export const connectivityProbe = new ConnectivityProbe()
