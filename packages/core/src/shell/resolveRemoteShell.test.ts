import { describe, expect, it } from 'vitest'
import { buildFallbackPs1 } from './remotePrompt'
import { resolveRemoteShellInvoke } from './resolveRemoteShell'

describe('resolveRemoteShellInvoke', () => {
  it('uses default shell when profile shell is empty and prompt fallback is off', () => {
    expect(resolveRemoteShellInvoke(null)).toEqual({ mode: 'default' })
    expect(resolveRemoteShellInvoke('')).toEqual({ mode: 'default' })
    expect(resolveRemoteShellInvoke('   ')).toEqual({ mode: 'default' })
  })

  it('uses login bash with inline PS1 when profile shell is empty and prompt fallback is on', () => {
    const result = resolveRemoteShellInvoke(null, { promptFallback: true })
    expect(result.mode).toBe('exec')
    if (result.mode === 'exec') {
      expect(result.command).toContain('/bin/bash --login -i')
      expect(result.command).toContain(`PS1='${buildFallbackPs1().replace(/'/g, `'\\''`)}'`)
    }
  })

  it('augments bare bash with login and interactive flags', () => {
    expect(resolveRemoteShellInvoke('/bin/bash')).toEqual({
      mode: 'exec',
      command: '/bin/bash --login -i'
    })
    expect(resolveRemoteShellInvoke('bash')).toEqual({
      mode: 'exec',
      command: 'bash --login -i'
    })
  })

  it('augments sh and zsh', () => {
    expect(resolveRemoteShellInvoke('/bin/sh')).toEqual({
      mode: 'exec',
      command: '/bin/sh -l'
    })
    expect(resolveRemoteShellInvoke('zsh')).toEqual({
      mode: 'exec',
      command: 'zsh -l -i'
    })
  })

  it('does not duplicate existing flags', () => {
    expect(resolveRemoteShellInvoke('/bin/bash -l -i')).toEqual({
      mode: 'exec',
      command: '/bin/bash -l -i'
    })
    expect(resolveRemoteShellInvoke('/bin/bash --login')).toEqual({
      mode: 'exec',
      command: '/bin/bash --login -i'
    })
  })

  it('passes through custom shell commands unchanged', () => {
    const custom = '/usr/local/bin/fish --no-private'
    expect(resolveRemoteShellInvoke(custom)).toEqual({
      mode: 'exec',
      command: custom
    })
  })

  it('embeds fallback PS1 in command when promptFallback is enabled', () => {
    const result = resolveRemoteShellInvoke('/bin/bash', { promptFallback: true })
    expect(result.mode).toBe('exec')
    if (result.mode === 'exec') {
      expect(result.command).toContain('/bin/bash --login -i')
      expect(result.command.startsWith('PS1=')).toBe(true)
    }
  })

  it('omits PS1 prefix when promptFallback is disabled', () => {
    expect(resolveRemoteShellInvoke('/bin/bash', { promptFallback: false })).toEqual({
      mode: 'exec',
      command: '/bin/bash --login -i'
    })
  })
})

describe('buildFallbackPs1', () => {
  it('includes user host and path tokens', () => {
    expect(buildFallbackPs1()).toContain('\\u@\\h')
    expect(buildFallbackPs1()).toContain('\\w')
  })
})
