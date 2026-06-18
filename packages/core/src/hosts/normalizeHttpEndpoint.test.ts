import { describe, expect, it } from 'vitest'
import { normalizeHttpEndpoint } from './normalizeHttpEndpoint'

describe('normalizeHttpEndpoint', () => {
  it('returns null for empty values', () => {
    expect(normalizeHttpEndpoint(null)).toBeNull()
    expect(normalizeHttpEndpoint(undefined)).toBeNull()
    expect(normalizeHttpEndpoint('')).toBeNull()
    expect(normalizeHttpEndpoint('   ')).toBeNull()
  })

  it('accepts valid http and https URLs', () => {
    expect(normalizeHttpEndpoint('https://alb.example/health')).toBe('https://alb.example/health')
    expect(normalizeHttpEndpoint('http://10.0.0.1:8080/')).toBe('http://10.0.0.1:8080/')
  })

  it('normalizes URLs', () => {
    expect(normalizeHttpEndpoint('https://example.com/path?q=1')).toBe(
      'https://example.com/path?q=1'
    )
  })

  it('rejects invalid URLs', () => {
    expect(() => normalizeHttpEndpoint('not-a-url')).toThrow(
      'HTTP endpoint must be a valid http(s) URL'
    )
    expect(() => normalizeHttpEndpoint('/relative/path')).toThrow(
      'HTTP endpoint must be a valid http(s) URL'
    )
  })

  it('rejects non-http protocols', () => {
    expect(() => normalizeHttpEndpoint('ftp://example.com')).toThrow(
      'HTTP endpoint must be a valid http(s) URL'
    )
  })
})
