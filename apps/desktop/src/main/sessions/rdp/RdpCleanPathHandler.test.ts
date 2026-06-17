import { describe, expect, it, vi } from 'vitest'
import { RDCLEANPATH_VERSION } from '@consoleri/core'
import {
  TAG_SEQUENCE,
  derEncodeInteger,
  derEncodeOctetString,
  derEncodeUtf8String,
  derWrap,
  derWrapContext
} from '@consoleri/core'
import { RdpCleanPathHandler } from './RdpCleanPathHandler'
import type { HandshakeResult, RdpHandshakePort, RdpRelayPort, WebSocketLike } from './types'

function buildTestRequest(destination = 'db.example:3389'): Buffer {
  const parts = [
    derWrapContext(0, derEncodeInteger(RDCLEANPATH_VERSION)),
    derWrapContext(2, derEncodeUtf8String(destination)),
    derWrapContext(6, derEncodeOctetString(Buffer.from([0x03, 0x00, 0x00])))
  ]
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}

class MockWebSocket implements WebSocketLike {
  readonly readyState = 1
  readonly sent: Buffer[] = []
  closed = false
  private messageListeners: Array<(data: Buffer) => void> = []

  send(data: Buffer): void {
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
  }

  on(event: 'message', listener: (data: Buffer) => void): void
  on(event: 'close', listener: () => void): void
  on(event: 'error', listener: (err: Error) => void): void
  on(
    event: 'message' | 'close' | 'error',
    listener: ((data: Buffer) => void) | (() => void) | ((err: Error) => void)
  ): void {
    if (event === 'message') {
      this.messageListeners.push(listener as (data: Buffer) => void)
    }
  }

  once(_event: 'message', listener: (data: Buffer) => void): void {
    this.messageListeners.push(listener)
  }

  emitMessage(data: Buffer): void {
    for (const listener of [...this.messageListeners]) {
      listener(data)
    }
  }
}

describe('RdpCleanPathHandler', () => {
  it('completes handshake and starts relay for allowed destination', async () => {
    const ws = new MockWebSocket()
    const tlsSocket = { destroyed: false } as HandshakeResult['tlsSocket']
    const handshake: RdpHandshakePort = {
      perform: vi.fn(async () => ({
        x224Response: Buffer.from([0x03, 0x00, 0x00, 0x13, 0x0e]),
        certChain: [Buffer.from([0x30, 0x01])],
        tlsSocket
      }))
    }
    const relay: RdpRelayPort = {
      attach: vi.fn()
    }

    const handler = new RdpCleanPathHandler({
      allowedTarget: { host: 'db.example', port: 3389 },
      handshake,
      relay
    })

    handler.handleConnection(ws)
    ws.emitMessage(buildTestRequest())

    await vi.waitFor(() => {
      expect(handshake.perform).toHaveBeenCalledOnce()
      expect(ws.sent.length).toBe(1)
      expect(relay.attach).toHaveBeenCalledWith(ws, tlsSocket, expect.any(Function))
    })
  })

  it('rejects destinations outside the allowed target', async () => {
    const ws = new MockWebSocket()
    const handshake: RdpHandshakePort = {
      perform: vi.fn()
    }
    const relay: RdpRelayPort = {
      attach: vi.fn()
    }

    const handler = new RdpCleanPathHandler({
      allowedTarget: { host: 'db.example', port: 3389 },
      handshake,
      relay
    })

    handler.handleConnection(ws)
    ws.emitMessage(buildTestRequest('other.example:3389'))

    await vi.waitFor(() => {
      expect(handshake.perform).not.toHaveBeenCalled()
      expect(ws.closed).toBe(true)
      expect(ws.sent.length).toBe(1)
    })
  })

  it('sends error PDU when handshake fails', async () => {
    const ws = new MockWebSocket()
    const handshake: RdpHandshakePort = {
      perform: vi.fn(async () => {
        throw new Error('TLS failed')
      })
    }
    const relay: RdpRelayPort = {
      attach: vi.fn()
    }

    const handler = new RdpCleanPathHandler({
      allowedTarget: { host: 'db.example', port: 3389 },
      handshake,
      relay
    })

    handler.handleConnection(ws)
    ws.emitMessage(buildTestRequest())

    await vi.waitFor(() => {
      expect(ws.closed).toBe(true)
      expect(ws.sent.length).toBe(1)
      expect(relay.attach).not.toHaveBeenCalled()
    })
  })
})
