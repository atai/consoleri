import http from 'node:http'
import https from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'

export const DEFAULT_VAULT_REQUEST_TIMEOUT_MS = 15_000

export interface VaultRequestOptions {
  address: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'LIST'
  token?: string
  namespace?: string
  body?: unknown
  tlsSkipVerify?: boolean
  timeoutMs?: number
}

export interface VaultResponseBody {
  data?: Record<string, unknown>
  auth?: {
    client_token?: string
    lease_duration?: number
    renewable?: boolean
  }
  errors?: string[]
}

function normalizeAddress(address: string): URL {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('Vault address is not configured')
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withScheme)
}

function attachRequestTimeout(
  req: ClientRequest,
  timeoutMs: number,
  reject: (error: Error) => void
): void {
  req.setTimeout(timeoutMs, () => {
    req.destroy()
    reject(
      new Error(`Vault request timed out (${Math.round(timeoutMs / 1000)}s). Check address and network.`)
    )
  })
}

function readResponse<T>(
  res: IncomingMessage,
  resolve: (value: T) => void,
  reject: (error: Error) => void
): void {
  const chunks: Buffer[] = []
  res.on('data', (chunk: Buffer) => chunks.push(chunk))
  res.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8')
    let parsed: T
    try {
      parsed = text ? (JSON.parse(text) as T) : ({} as T)
    } catch {
      reject(new Error(`Invalid Vault response (${res.statusCode ?? 'unknown'})`))
      return
    }

    if (res.statusCode && res.statusCode >= 400) {
      const body = parsed as VaultResponseBody
      const message = body.errors?.join('; ') || text || `HTTP ${res.statusCode}`
      reject(new Error(message))
      return
    }
    resolve(parsed)
  })
}

export async function vaultRequest<T extends VaultResponseBody>(
  options: VaultRequestOptions
): Promise<T> {
  const url = normalizeAddress(options.address)
  const requestPath = `/v1/${options.path.replace(/^\/+/, '')}`
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)
  const timeoutMs = options.timeoutMs ?? DEFAULT_VAULT_REQUEST_TIMEOUT_MS

  return new Promise<T>((resolve, reject) => {
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http
    const headers: Record<string, string> = {
      Accept: 'application/json'
    }
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = String(Buffer.byteLength(payload))
    }
    if (options.token) headers['X-Vault-Token'] = options.token
    if (options.namespace?.trim()) headers['X-Vault-Namespace'] = options.namespace.trim()

    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: requestPath,
        method: options.method,
        headers,
        rejectUnauthorized: isHttps ? !options.tlsSkipVerify : undefined
      },
      (res) => readResponse<T>(res, resolve, reject)
    )

    attachRequestTimeout(req, timeoutMs, reject)
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

export async function vaultHealthCheck(options: {
  address: string
  namespace?: string
  tlsSkipVerify?: boolean
  timeoutMs?: number
}): Promise<{ initialized: boolean; sealed: boolean }> {
  const url = normalizeAddress(options.address)
  const isHttps = url.protocol === 'https:'
  const transport = isHttps ? https : http
  const timeoutMs = options.timeoutMs ?? DEFAULT_VAULT_REQUEST_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/v1/sys/health',
        method: 'GET',
        headers: options.namespace?.trim()
          ? { 'X-Vault-Namespace': options.namespace.trim() }
          : undefined,
        rejectUnauthorized: isHttps ? !options.tlsSkipVerify : undefined
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const status = res.statusCode ?? 0
          if (status === 501) {
            resolve({ initialized: false, sealed: true })
            return
          }
          if (status >= 500) {
            reject(new Error(`Vault health check failed with HTTP ${status}`))
            return
          }
          resolve({
            initialized: status !== 503,
            sealed: status === 503 || status === 501
          })
        })
      }
    )
    attachRequestTimeout(req, timeoutMs, reject)
    req.on('error', reject)
    req.end()
  })
}
