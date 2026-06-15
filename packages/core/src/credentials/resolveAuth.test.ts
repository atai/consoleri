import { describe, expect, it } from 'vitest'
import { applyAuthToConnectConfig, authTypeFromCredentialRef } from './resolveAuth'

describe('authTypeFromCredentialRef', () => {
  it('detects key vs password refs', () => {
    expect(authTypeFromCredentialRef('profile:1:key')).toBe('privateKey')
    expect(authTypeFromCredentialRef('profile:1:password')).toBe('password')
    expect(authTypeFromCredentialRef(null)).toBe('none')
  })
})

describe('applyAuthToConnectConfig', () => {
  it('maps secret to ssh2 fields', () => {
    expect(applyAuthToConnectConfig('profile:1:key', 'KEY')).toEqual({ privateKey: 'KEY' })
    expect(applyAuthToConnectConfig('profile:1:password', 'pass')).toEqual({ password: 'pass' })
    expect(applyAuthToConnectConfig(null, null)).toEqual({})
  })
})
