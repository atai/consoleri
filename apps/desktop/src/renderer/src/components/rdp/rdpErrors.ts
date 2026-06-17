import { formatWsaErrorCode } from '@consoleri/core'

const IRON_ERROR_KIND_LABEL: Record<number, string> = {
  0: 'General error',
  1: 'Wrong password',
  2: 'Logon failure',
  3: 'Access denied',
  4: 'RDCleanPath error',
  5: 'Proxy connect failed',
  6: 'Protocol negotiation failed'
}

interface IronErrorLike {
  backtrace(): string
  kind(): number
  rdcleanpathDetails?(): {
    readonly httpStatusCode?: number
    readonly tlsAlertCode?: number
    readonly wsaErrorCode?: number
  }
}

function formatIronErrorDetails(err: IronErrorLike): string[] {
  const parts: string[] = []

  try {
    const kind = err.kind()
    parts.push(IRON_ERROR_KIND_LABEL[kind] ?? `Error kind ${kind}`)
  } catch {
    /* ignore */
  }

  try {
    const trace = err.backtrace()
    if (trace) parts.push(trace)
  } catch {
    /* ignore */
  }

  try {
    const details = err.rdcleanpathDetails?.()
    if (details?.wsaErrorCode != null) {
      parts.push(formatWsaErrorCode(details.wsaErrorCode))
    }
    if (details?.httpStatusCode != null) {
      parts.push(`HTTP status ${details.httpStatusCode}`)
    }
    if (details?.tlsAlertCode != null) {
      parts.push(`TLS alert ${details.tlsAlertCode}`)
    }
  } catch {
    /* ignore */
  }

  return parts
}

export function formatIronError(err: unknown): string {
  if (err && typeof err === 'object' && 'backtrace' in err && 'kind' in err) {
    const parts = formatIronErrorDetails(err as IronErrorLike)
    if (parts.length > 0) return parts.join(' — ')
  }

  if (err && typeof err === 'object' && 'backtrace' in err) {
    try {
      const trace = (err as IronErrorLike).backtrace()
      if (trace) return trace
    } catch {
      /* fall through */
    }
  }

  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.length > 0) return err
  return 'RDP connection failed'
}

export function logRdpError(
  sessionId: string,
  err: unknown,
  phase: string,
  appendLog: (
    sessionId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ) => Promise<void>
): void {
  const message = formatIronError(err)
  void appendLog(sessionId, 'error', `RDP ${phase}: ${message}`)
}
