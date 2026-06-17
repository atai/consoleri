export interface TcpConnectErrorLike {
  code?: string
  message?: string
}

const TCP_CONNECT_HINTS: Record<string, (host: string, port: number) => string> = {
  ECONNREFUSED: (host, port) =>
    `RDP server at ${host}:${port} refused the connection (port closed or RDP disabled)`,
  ETIMEDOUT: (host, port) =>
    `Connection to ${host}:${port} timed out (firewall, routing, or host offline)`,
  EHOSTUNREACH: (host, port) => `Host ${host}:${port} is unreachable from this machine`,
  ENOTFOUND: (host) => `Host ${host} could not be resolved (DNS failure)`,
  EACCES: (host, port) =>
    `Connection to ${host}:${port} blocked by local firewall or permissions`,
  ENETUNREACH: (host, port) => `Network unreachable while connecting to ${host}:${port}`
}

export function formatTcpConnectError(
  host: string,
  port: number,
  err: TcpConnectErrorLike
): string {
  const code = err.code ?? 'UNKNOWN'
  const hint = TCP_CONNECT_HINTS[code]?.(host, port)
  if (hint) return hint
  const message = err.message?.trim()
  if (message) {
    return `TCP connection to ${host}:${port} failed (${code}: ${message})`
  }
  return `TCP connection to ${host}:${port} failed (${code})`
}

export function formatWsaErrorCode(code: number): string {
  const known: Record<number, string> = {
    10013: 'Connection blocked (WSAEACCES — firewall or network policy)',
    10060: 'Connection timed out (WSAETIMEDOUT)',
    10061: 'Connection refused — RDP not listening or wrong port (WSAECONNREFUSED)',
    10051: 'Network unreachable (WSAENETUNREACH)',
    10065: 'No route to host (WSAEHOSTUNREACH)'
  }
  return known[code] ?? `Windows socket error ${code}`
}
