import { describe, expect, it } from 'vitest'
import {
  assertAllowedDestination,
  buildRdpDestination,
  destinationsMatch,
  normalizeDesktopSize,
  resolveRdpPort
} from './resolve'

describe('resolveRdpPort', () => {
  it('uses profile extra when set', () => {
    expect(resolveRdpPort({ rdpPort: 3390 })).toBe(3390)
  })

  it('falls back to default RDP port', () => {
    expect(resolveRdpPort({})).toBe(3389)
    expect(resolveRdpPort(null)).toBe(3389)
  })

  it('ignores invalid ports', () => {
    expect(resolveRdpPort({ rdpPort: 0 })).toBe(3389)
    expect(resolveRdpPort({ rdpPort: 70000 })).toBe(3389)
  })
})

describe('buildRdpDestination', () => {
  it('formats hostname:port', () => {
    expect(buildRdpDestination('db.example', 3389)).toBe('db.example:3389')
  })

  it('wraps IPv6 hostnames', () => {
    expect(buildRdpDestination('::1', 3389)).toBe('[::1]:3389')
  })
})

describe('normalizeDesktopSize', () => {
  it('applies minimum dimensions', () => {
    expect(normalizeDesktopSize(100, 200)).toEqual({ width: 800, height: 600 })
    expect(normalizeDesktopSize(1024, 768)).toEqual({ width: 1024, height: 768 })
  })
})

describe('assertAllowedDestination', () => {
  it('accepts matching destinations', () => {
    expect(() =>
      assertAllowedDestination('db.example:3389', 'db.example', 3389)
    ).not.toThrow()
    expect(destinationsMatch('DB.EXAMPLE:3389', 'db.example', 3389)).toBe(true)
  })

  it('rejects mismatched destinations', () => {
    expect(() =>
      assertAllowedDestination('other.example:3389', 'db.example', 3389)
    ).toThrow(/not allowed/)
  })
})
