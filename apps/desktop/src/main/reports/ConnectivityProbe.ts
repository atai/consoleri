import type { ConnectivityTestHostResult } from '@consoleri/core'
import { pingTarget } from './pingTarget'
import { sshReportConnection } from './SshReportConnection'
import type { ReportProbe } from './ReportProbe'

export class ConnectivityProbe implements ReportProbe<ConnectivityTestHostResult> {
  async probe(hostId: string, profileId: string): Promise<ConnectivityTestHostResult> {
    const started = Date.now()

    const [pingResult, sshConnection] = await Promise.all([
      pingTarget(hostId, profileId),
      sshReportConnection.connectForProfile(hostId, profileId)
    ])

    const log = [...pingResult.log, ...(sshConnection.log ?? [])]

    if (!sshConnection.ok) {
      return {
        hostId,
        profileId,
        status: sshConnection.status,
        durationMs: Date.now() - started,
        pingStatus: pingResult.status,
        pingDurationMs: pingResult.durationMs,
        pingError: pingResult.error,
        error: sshConnection.error,
        log
      }
    }

    sshConnection.client.end()
    return {
      hostId,
      profileId,
      status: 'ok',
      durationMs: Date.now() - started,
      pingStatus: pingResult.status,
      pingDurationMs: pingResult.durationMs,
      pingError: pingResult.error,
      log
    }
  }
}

export const connectivityProbe = new ConnectivityProbe()
