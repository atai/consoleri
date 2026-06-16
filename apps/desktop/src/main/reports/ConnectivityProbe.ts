import type { ConnectivityTestHostResult } from '@consoleri/core'
import { sshReportConnection } from './SshReportConnection'
import type { ReportProbe } from './ReportProbe'

export class ConnectivityProbe implements ReportProbe<ConnectivityTestHostResult> {
  async probe(hostId: string, profileId: string): Promise<ConnectivityTestHostResult> {
    const started = Date.now()

    const connection = await sshReportConnection.connectForProfile(hostId, profileId)
    if (!connection.ok) {
      return {
        hostId,
        profileId,
        status: connection.status,
        durationMs: Date.now() - started,
        error: connection.error,
        log: connection.log
      }
    }

    connection.client.end()
    return {
      hostId,
      profileId,
      status: 'ok',
      durationMs: Date.now() - started,
      log: connection.log
    }
  }
}

export const connectivityProbe = new ConnectivityProbe()
