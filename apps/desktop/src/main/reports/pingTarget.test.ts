import { describe, expect, it, vi } from 'vitest'

vi.mock('../logging/OperationLog', () => ({
  beginOperationLog: () => ({
    logId: 'test-log',
    log: vi.fn(),
    fail: (message: string) => {
      throw new Error(message)
    }
  })
}))

import { buildLocalPingArgs, buildRemotePingCommand } from './pingTarget'

describe('buildLocalPingArgs', () => {
  it('uses Windows ping flags on win32', () => {
    if (process.platform !== 'win32') return
    expect(buildLocalPingArgs('db.example')).toEqual({
      file: 'ping',
      args: ['-n', '1', '-w', '3000', 'db.example']
    })
  })

  it('uses macOS ping flags on darwin', () => {
    if (process.platform !== 'darwin') return
    expect(buildLocalPingArgs('db.example')).toEqual({
      file: 'ping',
      args: ['-c', '1', '-W', '3000', 'db.example']
    })
  })

  it('uses Linux ping flags on other platforms', () => {
    if (process.platform === 'win32' || process.platform === 'darwin') return
    expect(buildLocalPingArgs('db.example')).toEqual({
      file: 'ping',
      args: ['-c', '1', '-W', '3', 'db.example']
    })
  })
})

describe('buildRemotePingCommand', () => {
  it('builds a single-packet ping with shell-escaped hostname', () => {
    expect(buildRemotePingCommand('db.example')).toBe("ping -c 1 -W 3 'db.example'")
  })

  it('escapes single quotes in hostname', () => {
    expect(buildRemotePingCommand("it's")).toBe("ping -c 1 -W 3 'it'\\''s'")
  })
})
