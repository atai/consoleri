import { describe, expect, it } from 'vitest'
import { normalizeHostInput, normalizeProfileInput } from './normalizeInputs'

// ── normalizeHostInput ────────────────────────────────────────────────────────
describe('normalizeHostInput', () => {
  // Required fields
  it('returns error for missing name', () => {
    const result = normalizeHostInput({ name: '', hostname: '10.0.0.1' })
    expect(result.errors.name).toBeTruthy()
    expect(result.normalized).toBeNull()
  })

  it('returns error for missing hostname', () => {
    const result = normalizeHostInput({ name: 'web01', hostname: '' })
    expect(result.errors.hostname).toBeTruthy()
    expect(result.normalized).toBeNull()
  })

  it('trims whitespace from name and hostname', () => {
    const result = normalizeHostInput({ name: '  web01  ', hostname: '  10.0.0.1  ' })
    expect(result.errors).toEqual({})
    expect(result.normalized?.name).toBe('web01')
    expect(result.normalized?.hostname).toBe('10.0.0.1')
  })

  // Port validation
  it('defaults port to 22 when not provided', () => {
    const result = normalizeHostInput({ name: 'h', hostname: 'h.local' })
    expect(result.normalized?.port).toBe(22)
  })

  it('accepts valid port numbers', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 2222 }).normalized?.port).toBe(2222)
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 1 }).normalized?.port).toBe(1)
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 65535 }).normalized?.port).toBe(65535)
  })

  it('returns error for port out of range', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 0 }).errors.port).toBeTruthy()
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 65536 }).errors.port).toBeTruthy()
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: -1 }).errors.port).toBeTruthy()
  })

  it('returns error for non-integer port', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h', port: 22.5 }).errors.port).toBeTruthy()
  })

  // OsType
  it('defaults osType to unknown when not provided', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h' }).normalized?.osType).toBe('unknown')
  })

  it('passes through valid osType values', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h', osType: 'linux' }).normalized?.osType).toBe('linux')
    expect(normalizeHostInput({ name: 'h', hostname: 'h', osType: 'windows' }).normalized?.osType).toBe('windows')
  })

  it('rejects invalid osType', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h', osType: 'dos' as never }).errors.osType).toBeTruthy()
  })

  // Tags
  it('defaults tags to empty array', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h' }).normalized?.tags).toEqual([])
  })

  it('trims and lowercases tags', () => {
    const result = normalizeHostInput({ name: 'h', hostname: 'h', tags: ['  WEB  ', ' DB'] })
    expect(result.normalized?.tags).toEqual(['web', 'db'])
  })

  it('deduplicates tags', () => {
    const result = normalizeHostInput({ name: 'h', hostname: 'h', tags: ['web', 'WEB', 'web'] })
    expect(result.normalized?.tags).toEqual(['web'])
  })

  it('drops empty tag strings', () => {
    const result = normalizeHostInput({ name: 'h', hostname: 'h', tags: ['web', '  ', ''] })
    expect(result.normalized?.tags).toEqual(['web'])
  })

  // Notes
  it('trims notes whitespace', () => {
    const result = normalizeHostInput({ name: 'h', hostname: 'h', notes: '  notes  ' })
    expect(result.normalized?.notes).toBe('notes')
  })

  it('defaults notes to empty string', () => {
    expect(normalizeHostInput({ name: 'h', hostname: 'h' }).normalized?.notes).toBe('')
  })

  // No errors → normalized is populated
  it('returns no errors and a populated normalized object for valid minimal input', () => {
    const result = normalizeHostInput({ name: 'web01', hostname: '10.0.0.1' })
    expect(result.errors).toEqual({})
    expect(result.normalized).not.toBeNull()
  })
})

// ── normalizeProfileInput ─────────────────────────────────────────────────────
describe('normalizeProfileInput', () => {
  // Required fields
  it('returns error for missing name', () => {
    const result = normalizeProfileInput({ name: '', protocol: 'ssh' })
    expect(result.errors.name).toBeTruthy()
    expect(result.normalized).toBeNull()
  })

  it('returns error for missing protocol', () => {
    const result = normalizeProfileInput({ name: 'p', protocol: undefined as never })
    expect(result.errors.protocol).toBeTruthy()
    expect(result.normalized).toBeNull()
  })

  it('returns error for invalid protocol value', () => {
    const result = normalizeProfileInput({ name: 'p', protocol: 'ftp' as never })
    expect(result.errors.protocol).toBeTruthy()
    expect(result.normalized).toBeNull()
  })

  it('trims name whitespace', () => {
    const result = normalizeProfileInput({ name: '  ssh-prod  ', protocol: 'ssh' })
    expect(result.normalized?.name).toBe('ssh-prod')
  })

  // AuthMethod
  it('defaults authMethod to password', () => {
    expect(normalizeProfileInput({ name: 'p', protocol: 'ssh' }).normalized?.authMethod).toBe('password')
  })

  it('passes through valid authMethod values', () => {
    expect(normalizeProfileInput({ name: 'p', protocol: 'ssh', authMethod: 'key' }).normalized?.authMethod).toBe('key')
    expect(normalizeProfileInput({ name: 'p', protocol: 'ssh', authMethod: 'none' }).normalized?.authMethod).toBe('none')
  })

  it('returns error for invalid authMethod', () => {
    expect(
      normalizeProfileInput({ name: 'p', protocol: 'ssh', authMethod: 'cert' as never }).errors.authMethod
    ).toBeTruthy()
  })

  // Username trimming
  it('trims username whitespace', () => {
    const result = normalizeProfileInput({ name: 'p', protocol: 'ssh', username: '  admin  ' })
    expect(result.normalized?.username).toBe('admin')
  })

  it('converts empty username string to null', () => {
    const result = normalizeProfileInput({ name: 'p', protocol: 'ssh', username: '   ' })
    expect(result.normalized?.username).toBeNull()
  })

  it('defaults username to null when omitted', () => {
    expect(normalizeProfileInput({ name: 'p', protocol: 'ssh' }).normalized?.username).toBeNull()
  })

  // Valid protocols
  it('accepts all valid protocol values', () => {
    const protocols = ['ssh', 'rdp', 'vnc', 'local_pty', 'wsl'] as const
    for (const protocol of protocols) {
      const result = normalizeProfileInput({ name: 'p', protocol })
      expect(result.errors.protocol).toBeUndefined()
      expect(result.normalized?.protocol).toBe(protocol)
    }
  })

  // No errors → normalized is populated
  it('returns no errors and a populated normalized object for valid input', () => {
    const result = normalizeProfileInput({ name: 'ssh-prod', protocol: 'ssh', username: 'deploy' })
    expect(result.errors).toEqual({})
    expect(result.normalized).not.toBeNull()
    expect(result.normalized?.username).toBe('deploy')
  })
})
