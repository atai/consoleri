import type { ConnectivityTestHostResult } from '@consoleri/core'
import { pingTarget } from './pingTarget'
import { httpTarget } from './httpTarget'
import { sshReportConnection } from './SshReportConnection'
import type { ReportProbe } from './ReportProbe'

function mergeHttpFields(
  result: ConnectivityTestHostResult,
  httpResult: Awaited<ReturnType<typeof httpTarget>>
): ConnectivityTestHostResult {
  if (httpResult.httpStatusCode !== undefined) {
    result.httpStatusCode = httpResult.httpStatusCode
  }
  if (httpResult.httpDurationMs !== undefined) {
    result.httpDurationMs = httpResult.httpDurationMs
  }
  if (httpResult.httpError) {
    result.httpError = httpResult.httpError
  }
  return result
}

export class ConnectivityProbe implements ReportProbe<ConnectivityTestHostResult> {
  async probe(hostId: string, profileId: string): Promise<ConnectivityTestHostResult> {
    const started = Date.now()

    const [pingResult, sshConnection, httpResult] = await Promise.all([
      pingTarget(hostId, profileId),
      sshReportConnection.connectForProfile(hostId, profileId),
      httpTarget(hostId)
    ])

    const log = [...pingResult.log, ...httpResult.log, ...(sshConnection.log ?? [])]

    if (!sshConnection.ok) {
      return mergeHttpFields(
        {
          hostId,
          profileId,
          status: sshConnection.status,
          durationMs: Date.now() - started,
          pingStatus: pingResult.status,
          pingDurationMs: pingResult.durationMs,
          pingError: pingResult.error,
          error: sshConnection.error,
          log
        },
        httpResult
      )
    }

    sshConnection.client.end()
    return mergeHttpFields(
      {
        hostId,
        profileId,
        status: 'ok',
        durationMs: Date.now() - started,
        pingStatus: pingResult.status,
        pingDurationMs: pingResult.durationMs,
        pingError: pingResult.error,
        log
      },
      httpResult
    )
  }
}

export const connectivityProbe = new ConnectivityProbe()
