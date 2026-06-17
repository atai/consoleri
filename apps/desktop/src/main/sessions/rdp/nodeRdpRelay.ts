import type { TLSSocket } from 'node:tls'
import type { RdpRelayPort, WebSocketLike } from './types'

const WS_OPEN = 1

export class NodeRdpRelay implements RdpRelayPort {
  attach(ws: WebSocketLike, tlsSocket: TLSSocket, onClose?: (reason: string) => void): void {
    const cleanup = (source: string): void => {
      onClose?.(source)
      if (!tlsSocket.destroyed) tlsSocket.destroy()
      if (ws.readyState === WS_OPEN) {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }
    }

    tlsSocket.on('data', (data) => {
      try {
        if (ws.readyState === WS_OPEN) {
          ws.send(Buffer.from(data))
        }
      } catch {
        cleanup('relay-send-error')
      }
    })

    ws.on('message', (data) => {
      try {
        if (!tlsSocket.destroyed) {
          tlsSocket.write(Buffer.isBuffer(data) ? data : Buffer.from(data))
        }
      } catch {
        cleanup('relay-write-error')
      }
    })

    tlsSocket.on('end', () => cleanup('tls-end'))
    tlsSocket.on('error', () => cleanup('tls-error'))
    ws.on('close', () => cleanup('ws-close'))
    ws.on('error', () => cleanup('ws-error'))
  }
}

export const nodeRdpRelay = new NodeRdpRelay()
