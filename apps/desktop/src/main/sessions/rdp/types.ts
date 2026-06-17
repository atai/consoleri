import type { TLSSocket } from 'node:tls'

export interface AllowedTarget {
  host: string
  port: number
}

export interface HandshakeResult {
  x224Response: Buffer
  certChain: Buffer[]
  tlsSocket: TLSSocket
}

export interface RdpHandshakePort {
  perform(host: string, port: number, x224Request: Buffer): Promise<HandshakeResult>
}

export interface RdpRelayPort {
  attach(
    ws: WebSocketLike,
    tlsSocket: TLSSocket,
    onClose?: (reason: string) => void
  ): void
}

export interface WebSocketLike {
  readonly readyState: number
  send(data: Buffer): void
  close(): void
  on(event: 'message', listener: (data: Buffer) => void): void
  on(event: 'close', listener: () => void): void
  on(event: 'error', listener: (err: Error) => void): void
  once(event: 'message', listener: (data: Buffer) => void): void
}

export type RdpLogFn = (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void

export interface RdpProxyInfo {
  proxyUrl: string
  port: number
}
