import { formatTcpConnectError } from '@consoleri/core'
import net from 'node:net'
import tls from 'node:tls'
import type { PeerCertificate } from 'node:tls'
import type { HandshakeResult, RdpHandshakePort } from './types'

const HANDSHAKE_TIMEOUT_MS = 15_000

type ChainedPeerCertificate = PeerCertificate & {
  issuerCertificate?: ChainedPeerCertificate
}

function extractCertChain(peerCert: PeerCertificate): Buffer[] {
  const certs: Buffer[] = []
  if (!peerCert?.raw) return certs

  const seen = new Set<string>()
  let current: ChainedPeerCertificate | null = peerCert as ChainedPeerCertificate
  while (current?.raw) {
    const fingerprint = current.fingerprint256 ?? current.raw.toString('hex')
    if (seen.has(fingerprint)) break
    seen.add(fingerprint)
    certs.push(Buffer.from(current.raw))

    if (current.issuerCertificate && current.issuerCertificate !== current) {
      current = current.issuerCertificate
    } else {
      break
    }
  }
  return certs
}

export class NodeRdpHandshake implements RdpHandshakePort {
  perform(host: string, port: number, x224Request: Buffer): Promise<HandshakeResult> {
    return new Promise((resolve, reject) => {
      const tcpSocket = net.createConnection({ host, port })

      const fail = (message: string): void => {
        tcpSocket.destroy()
        reject(new Error(message))
      }

      tcpSocket.setTimeout(HANDSHAKE_TIMEOUT_MS, () => {
        fail(formatTcpConnectError(host, port, { code: 'ETIMEDOUT', message: 'RDP handshake timed out' }))
      })

      tcpSocket.once('error', (err: NodeJS.ErrnoException) => {
        fail(formatTcpConnectError(host, port, err))
      })

      tcpSocket.once('connect', () => {
        tcpSocket.write(x224Request, (writeErr) => {
          if (writeErr) {
            fail(`Failed to send X.224 request: ${writeErr.message}`)
            return
          }

          tcpSocket.once('data', (x224Response) => {
            if (x224Response.length === 0) {
              fail('RDP server closed connection without X.224 response')
              return
            }

            tcpSocket.removeAllListeners('error')
            tcpSocket.removeAllListeners('data')
            tcpSocket.setTimeout(0)

            const tlsSocket = tls.connect({
              socket: tcpSocket,
              servername: host,
              rejectUnauthorized: false
            })

            tlsSocket.once('secureConnect', () => {
              const certChain = extractCertChain(tlsSocket.getPeerCertificate(true))
              if (certChain.length === 0) {
                fail('No server certificate received during RDP handshake')
                return
              }

              resolve({
                x224Response: Buffer.from(x224Response),
                certChain,
                tlsSocket
              })
            })

            tlsSocket.once('error', (err) => {
              fail(`TLS handshake failed: ${err.message}`)
            })
          })
        })
      })
    })
  }
}

export const nodeRdpHandshake = new NodeRdpHandshake()
