import { describe, expect, it } from 'vitest'
import { formatIronError } from './rdpErrors'

describe('formatIronError', () => {
  it('uses iron error backtrace when available', () => {
    const err = {
      kind: () => 5,
      backtrace: () => 'ProxyConnect: failed to open websocket'
    }
    expect(formatIronError(err)).toBe('Proxy connect failed — ProxyConnect: failed to open websocket')
  })

  it('includes RDCleanPath WSA details', () => {
    const err = {
      kind: () => 4,
      backtrace: () => 'handshake failed',
      rdcleanpathDetails: () => ({ wsaErrorCode: 10061 })
    }
    expect(formatIronError(err)).toContain('Connection refused')
    expect(formatIronError(err)).toContain('handshake failed')
  })

  it('falls back to Error message', () => {
    expect(formatIronError(new Error('network down'))).toBe('network down')
  })

  it('returns default message for unknown values', () => {
    expect(formatIronError({})).toBe('RDP connection failed')
  })
})
