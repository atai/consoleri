import { createServer, type Server as HttpServer } from 'http'
import net from 'net'
import { WebSocketServer, type WebSocket } from 'ws'
import { BaseTransport } from './Transport'

export interface VncProxyInfo {
  proxyUrl: string
  port: number
}

export class VncProxy {
  private httpServer: HttpServer | null = null
  private wss: WebSocketServer | null = null
  private port = 0

  async start(host: string, port = 5900): Promise<VncProxyInfo> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer()
      this.wss = new WebSocketServer({ server: this.httpServer })

      this.wss.on('connection', (ws: WebSocket) => {
        const tcp = net.createConnection({ host, port }, () => {
          ws.on('message', (data) => {
            if (tcp.writable) {
              tcp.write(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
            }
          })
          tcp.on('data', (chunk) => {
            if (ws.readyState === ws.OPEN) ws.send(chunk)
          })
          tcp.on('close', () => ws.close())
          tcp.on('error', () => ws.close())
          ws.on('close', () => tcp.destroy())
        })
        tcp.on('error', (err) => {
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
          reject(new Error('Failed to bind VNC proxy'))
        }
      })
    })
  }

  stop(): void {
    this.wss?.close()
    this.httpServer?.close()
    this.wss = null
    this.httpServer = null
  }
}

export class VncSession extends BaseTransport {
  readonly protocol = 'vnc'
  readonly proxy: VncProxy
  readonly proxyUrl: string

  constructor(proxyUrl: string, proxy: VncProxy) {
    super()
    this.proxyUrl = proxyUrl
    this.proxy = proxy
  }

  write(_data: string): void {
    /* handled in renderer via noVNC */
  }

  resize(_cols: number, _rows: number): void {
    /* handled in renderer */
  }

  disconnect(): void {
    this.proxy.stop()
  }
}
