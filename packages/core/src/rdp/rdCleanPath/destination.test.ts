import { describe, expect, it } from 'vitest'
import { parseDestination } from './destination'

describe('parseDestination', () => {
  it('parses host:port', () => {
    expect(parseDestination('db.example:3390')).toEqual({ host: 'db.example', port: 3390 })
  })

  it('defaults port when omitted', () => {
    expect(parseDestination('db.example')).toEqual({ host: 'db.example', port: 3389 })
  })

  it('parses IPv6 destinations', () => {
    expect(parseDestination('[::1]:3389')).toEqual({ host: '::1', port: 3389 })
  })

  it('throws on invalid IPv6', () => {
    expect(() => parseDestination('[::1')).toThrow(/Invalid IPv6 destination/)
  })
})
