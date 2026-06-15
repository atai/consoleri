import { describe, expect, it } from 'vitest'
import { createBuiltinUxProfile } from './defaults'
import { resolveUxProfile } from './resolve'
import type { UxProfile } from './types'

function profile(id: string, overrides: Partial<UxProfile> = {}): UxProfile {
  const builtin = createBuiltinUxProfile()
  return {
    ...builtin,
    id,
    name: id,
    isBuiltin: false,
    ...overrides
  }
}

describe('resolveUxProfile', () => {
  const profiles = [
    createBuiltinUxProfile(),
    profile('custom-a'),
    profile('custom-b')
  ]

  it('prefers host profile over global active', () => {
    const resolved = resolveUxProfile(profiles, {
      hostUxProfileId: 'custom-a',
      activeUxProfileId: 'custom-b'
    })
    expect(resolved.id).toBe('custom-a')
  })

  it('falls back to global active when host has no override', () => {
    const resolved = resolveUxProfile(profiles, {
      hostUxProfileId: null,
      activeUxProfileId: 'custom-b'
    })
    expect(resolved.id).toBe('custom-b')
  })

  it('falls back to builtin when ids are missing or unknown', () => {
    expect(resolveUxProfile(profiles, {}).id).toBe('builtin-github-dark')
    expect(
      resolveUxProfile(profiles, {
        hostUxProfileId: 'missing',
        activeUxProfileId: 'also-missing'
      }).id
    ).toBe('builtin-github-dark')
  })
})
