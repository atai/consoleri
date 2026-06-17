import { describe, expect, it } from 'vitest'
import { formatTcpConnectError, formatWsaErrorCode } from './networkErrors'

describe('formatTcpConnectError', () => {
  it('explains refused connections', () => {
    expect(formatTcpConnectError('10.0.0.5', 3389, { code: 'ECONNREFUSED' })).toContain(
      'refused the connection'
    )
  })

  it('explains timeouts', () => {
    expect(formatTcpConnectError('10.0.0.5', 3389, { code: 'ETIMEDOUT' })).toContain('timed out')
  })

  it('falls back to code and message', () => {
    expect(formatTcpConnectError('host', 3389, { code: 'EPIPE', message: 'broken pipe' })).toBe(
      'TCP connection to host:3389 failed (EPIPE: broken pipe)'
    )
  })
})

describe('formatWsaErrorCode', () => {
  it('maps common Windows socket codes', () => {
    expect(formatWsaErrorCode(10061)).toContain('refused')
  })
})
