import { hostRepository } from '../hosts/HostRepository'

export const HTTP_TIMEOUT_MS = 10000

export type HttpTargetResult = {
  httpStatusCode?: number
  httpDurationMs?: number
  httpError?: string
  log: string[]
}

export async function httpTarget(hostId: string): Promise<HttpTargetResult> {
  const host = hostRepository.getHost(hostId)
  if (!host?.httpEndpoint) {
    return { log: [] }
  }

  const url = host.httpEndpoint
  const started = Date.now()
  const log: string[] = [`HTTP GET ${url}`]

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
    })
    const durationMs = Date.now() - started
    log.push(`→ ${response.status}`)
    return {
      httpStatusCode: response.status,
      httpDurationMs: durationMs,
      log
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const durationMs = Date.now() - started
    log.push(`HTTP failed: ${message}`)
    return {
      httpError: message,
      httpDurationMs: durationMs,
      log
    }
  }
}
