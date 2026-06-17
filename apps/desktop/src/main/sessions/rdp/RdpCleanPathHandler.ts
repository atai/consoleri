import {
  assertAllowedDestination,
  buildRDCleanPathError,
  buildRDCleanPathResponse,
  buildRdpDestination,
  parseRDCleanPathRequest
} from '@consoleri/core'
import type { AllowedTarget, RdpHandshakePort, RdpLogFn, RdpRelayPort, WebSocketLike } from './types'

export interface RdpCleanPathHandlerDeps {
  allowedTarget: AllowedTarget
  handshake: RdpHandshakePort
  relay: RdpRelayPort
  log?: RdpLogFn
}

export class RdpCleanPathHandler {
  constructor(private readonly deps: RdpCleanPathHandlerDeps) {}

  handleConnection(ws: WebSocketLike): void {
    ws.once('message', (data) => {
      void this.processRequest(ws, data)
    })

    ws.on('error', (err) => {
      this.deps.log?.('error', `WebSocket error: ${err.message}`)
    })
  }

  private async processRequest(ws: WebSocketLike, data: Buffer): Promise<void> {
    try {
      const requestData = Buffer.isBuffer(data) ? data : Buffer.from(data)
      this.deps.log?.('info', `Received RDCleanPath request (${requestData.length} bytes)`)

      const request = parseRDCleanPathRequest(requestData)
      assertAllowedDestination(
        request.destination,
        this.deps.allowedTarget.host,
        this.deps.allowedTarget.port
      )

      const { host, port } = this.deps.allowedTarget
      this.deps.log?.('info', `RDCleanPath handshake → ${host}:${port}`)

      const { x224Response, certChain, tlsSocket } = await this.deps.handshake.perform(
        host,
        port,
        request.x224ConnectionRequest
      )

      const serverAddr = buildRdpDestination(host, port)
      const responsePdu = buildRDCleanPathResponse(serverAddr, x224Response, certChain)
      ws.send(responsePdu)

      this.deps.log?.('info', 'RDCleanPath handshake complete — starting relay')
      this.deps.relay.attach(ws, tlsSocket, (reason) => {
        this.deps.log?.('debug', `RDP relay closed: ${reason}`)
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.deps.log?.('error', `RDCleanPath handshake failed: ${message}`)

      try {
        ws.send(buildRDCleanPathError(1, 502))
      } catch {
        /* ignore */
      }

      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }
}
