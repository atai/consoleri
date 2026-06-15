import { describe, expect, it } from 'vitest'
import { defaultPortForProtocol, isTerminalProtocol } from './protocols'

describe('isTerminalProtocol', () => {
  it('returns true for terminal protocols', () => {
    expect(isTerminalProtocol('ssh')).toBe(true)
    expect(isTerminalProtocol('local_pty')).toBe(true)
    expect(isTerminalProtocol('wsl')).toBe(true)
  })

  it('returns false for remote desktop protocols', () => {
    expect(isTerminalProtocol('rdp')).toBe(false)
    expect(isTerminalProtocol('vnc')).toBe(false)
  })
})

describe('defaultPortForProtocol', () => {
  it('maps protocols to default ports', () => {
    expect(defaultPortForProtocol('ssh')).toBe(22)
    expect(defaultPortForProtocol('rdp')).toBe(3389)
    expect(defaultPortForProtocol('vnc')).toBe(5900)
  })
})
