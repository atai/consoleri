import type { Protocol } from './types'

export function isTerminalProtocol(protocol: Protocol): boolean {
  return protocol === 'ssh' || protocol === 'local_pty' || protocol === 'wsl'
}

export function defaultPortForProtocol(protocol: Protocol): number {
  switch (protocol) {
    case 'rdp':
      return 3389
    case 'vnc':
      return 5900
    case 'ssh':
    default:
      return 22
  }
}
