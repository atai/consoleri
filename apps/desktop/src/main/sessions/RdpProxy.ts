import { createServer, type Server as HttpServer } from 'http'
import net from 'net'
import { WebSocketServer, type WebSocket } from 'ws'
import { BaseTransport } from './Transport'

export interface RdpProxyInfo {
  proxyUrl: string
  port: number
}

export class RdpProxy {
  private httpServer: HttpServer | null = null
  private wss: WebSocketServer | null = null
  private port = 0

  async start(host: string, port = 3389): Promise<RdpProxyInfo> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer()
      this.wss = new WebSocketServer({ server: this.httpServer })

      this.wss.on('connection', (ws: WebSocket) => {
        const tcpSocket = net.createConnection({ host, port }, () => {
          ws.on('message', (data) => {
            if (tcpSocket.writable) {
              tcpSocket.write(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
            }
          })
          tcpSocket.on('data', (chunk) => {
            if (ws.readyState === ws.OPEN) ws.send(chunk)
          })
          tcpSocket.on('close', () => ws.close())
          tcpSocket.on('error', (err) => {
            ws.close()
            this.emitError(err)
          })
          ws.on('close', () => tcpSocket.destroy())
        })
        tcpSocket.on('error', (err) => {
          ws.close()
          reject(err)
        })
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

  private emitError(_err: Error): void {
    /* logged by session manager */
  }

  stop(): void {
    this.wss?.close()
    this.httpServer?.close()
    this.wss = null
    this.httpServer = null
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
