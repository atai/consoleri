export interface ParsedDestination {
  host: string
  port: number
}

const DEFAULT_RDP_PORT = 3389

/**
 * Parse a destination string into host and port.
 * Supports IPv6 "[::1]:3389" and regular "host:port" formats.
 */
export function parseDestination(destination: string): ParsedDestination {
  if (destination.startsWith('[')) {
    const bracketEnd = destination.indexOf(']')
    if (bracketEnd === -1) {
      throw new Error(`Invalid IPv6 destination: ${destination}`)
    }
    const host = destination.slice(1, bracketEnd)
    const rest = destination.slice(bracketEnd + 1)
    const port = rest.startsWith(':') ? parseInt(rest.slice(1), 10) : DEFAULT_RDP_PORT
    return { host, port }
  }

  const lastColon = destination.lastIndexOf(':')
  if (lastColon === -1) {
    return { host: destination, port: DEFAULT_RDP_PORT }
  }

  const host = destination.slice(0, lastColon)
  const port = parseInt(destination.slice(lastColon + 1), 10)
  if (Number.isNaN(port)) {
    return { host: destination, port: DEFAULT_RDP_PORT }
  }
  return { host, port }
}
