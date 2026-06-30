import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ClientRequest, IncomingMessage } from 'node:http'

const requestMock = vi.fn()

vi.mock('node:https', () => ({
  default: { request: requestMock },
  request: requestMock
}))

vi.mock('node:http', () => ({
  default: { request: requestMock },
  request: requestMock
}))

class MockRequest extends EventEmitter {
  destroyed = false
  timeoutCallback?: () => void
  setTimeout = vi.fn((_: number, cb: () => void) => {
    this.timeoutCallback = cb
    return this
  })
  destroy = vi.fn(() => {
    this.destroyed = true
  })
  write = vi.fn()
  end = vi.fn()
}

function mockResponse(statusCode: number, body: string): IncomingMessage {
  const res = new EventEmitter() as IncomingMessage
  res.statusCode = statusCode
  queueMicrotask(() => {
    res.emit('data', Buffer.from(body))
    res.emit('end')
  })
  return res
}

describe('vaultRequest timeout', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the request times out', async () => {
    const { vaultRequest } = await import('./vaultClient')
    const req = new MockRequest()
    requestMock.mockReturnValue(req as unknown as ClientRequest)

    const promise = vaultRequest({
      address: 'https://vault.example.com:8200',
      path: 'sys/health',
      method: 'GET',
      timeoutMs: 50
    })

    req.timeoutCallback?.()
    await expect(promise).rejects.toThrow(/timed out/i)
    expect(req.destroy).toHaveBeenCalled()
  })

  it('resolves successful responses before timeout', async () => {
    const { vaultRequest } = await import('./vaultClient')
    const req = new MockRequest()
    requestMock.mockImplementation((_opts, cb) => {
      cb?.(mockResponse(200, '{"data":{"ok":true}}'))
      return req as unknown as ClientRequest
    })

    const response = await vaultRequest({
      address: 'https://vault.example.com:8200',
      path: 'secret/data/test',
      method: 'GET',
      timeoutMs: 5000
    })

    expect(response.data?.ok).toBe(true)
  })
})
