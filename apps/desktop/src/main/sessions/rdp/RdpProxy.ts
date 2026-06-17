import { createServer, type Server as HttpServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import { BaseTransport } from '../Transport'
import { RdpCleanPathHandler } from './RdpCleanPathHandler'
import { nodeRdpHandshake } from './nodeRdpHandshake'
import { nodeRdpRelay } from './nodeRdpRelay'
import type { AllowedTarget, RdpLogFn, RdpProxyInfo } from './types'

export class RdpProxy {
  private httpServer: HttpServer | null = null
  private wss: WebSocketServer | null = null
  private port = 0
  private allowedTarget: AllowedTarget | null = null
  private log: RdpLogFn | null = null

  async start(host: string, port = 3389, log?: RdpLogFn): Promise<RdpProxyInfo> {
    this.allowedTarget = { host, port }
    this.log = log ?? null

    return new Promise((resolve, reject) => {
      this.httpServer = createServer()
      this.wss = new WebSocketServer({ server: this.httpServer })

      this.wss.on('connection', (ws: WebSocket) => {
        if (!this.allowedTarget) {
          ws.close()
          return
        }

        this.log?.('info', 'RDP WebSocket client connected')

        const handler = new RdpCleanPathHandler({
          allowedTarget: this.allowedTarget,
          handshake: nodeRdpHandshake,
          relay: nodeRdpRelay,
          log: this.log ?? undefined
        })
        handler.handleConnection(ws)
      })

      this.httpServer.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer!.address()
        if (addr && typeof addr === 'object') {
          this.port = addr.port
          resolve({ proxyUrl: `ws://127.0.0.1:${this.port}`, port: this.port })
        } else {
          reject(new Error('Failed to bind RDP proxy'))
        }
      })
    })
  }

  stop(): void {
    this.wss?.close()
    this.httpServer?.close()
    this.wss = null
    this.httpServer = null
    this.allowedTarget = null
    this.log = null
  }
}

export class RdpSession extends BaseTransport {
  readonly protocol = 'rdp'
  readonly proxy: RdpProxy
  readonly proxyUrl: string

  constructor(proxyUrl: string, proxy: RdpProxy) {
    super()
    this.proxyUrl = proxyUrl
    this.proxy = proxy
  }

  write(_data: string): void {
    /* input handled in renderer via ironrdp */
  }

  resize(_cols: number, _rows: number): void {
    /* handled in renderer */
  }

  disconnect(): void {
    this.proxy.stop()
  }
}

export type { RdpProxyInfo } from './types'
