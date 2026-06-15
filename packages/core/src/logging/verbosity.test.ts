import { describe, expect, it } from 'vitest'
import {
  normalizeHostLogVerbosity,
  shouldIncludeLogEntry,
  sshDebugEnabled
} from './verbosity'

describe('shouldIncludeLogEntry', () => {
  it('filters debug on normal verbosity', () => {
    expect(shouldIncludeLogEntry('info', 'info')).toBe(true)
    expect(shouldIncludeLogEntry('info', 'debug')).toBe(false)
  })

  it('keeps only warnings and errors on quiet', () => {
    expect(shouldIncludeLogEntry('quiet', 'error')).toBe(true)
    expect(shouldIncludeLogEntry('quiet', 'warn')).toBe(true)
    expect(shouldIncludeLogEntry('quiet', 'info')).toBe(false)
  })

  it('includes app debug on verbose but not ssh2 wire logs', () => {
    expect(shouldIncludeLogEntry('verbose', 'debug')).toBe(true)
    expect(shouldIncludeLogEntry('verbose', 'debug', { source: 'ssh2' })).toBe(false)
  })

  it('includes ssh2 wire logs only on trace', () => {
    expect(shouldIncludeLogEntry('trace', 'debug', { source: 'ssh2' })).toBe(true)
  })
})

describe('sshDebugEnabled', () => {
  it('is enabled only for trace', () => {
    expect(sshDebugEnabled('trace')).toBe(true)
    expect(sshDebugEnabled('verbose')).toBe(false)
    expect(sshDebugEnabled('info')).toBe(false)
  })
})

describe('normalizeHostLogVerbosity', () => {
  it('falls back to info for unknown values', () => {
    expect(normalizeHostLogVerbosity('bogus')).toBe('info')
    expect(normalizeHostLogVerbosity('trace')).toBe('trace')
  })
})
