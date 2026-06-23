import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { ITransport } from './Transport'
import type { SessionTransportResult } from './SessionFactory'

// ── Electron stub ─────────────────────────────────────────────────────────────
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test' }
}))

// ── Dependency stubs ──────────────────────────────────────────────────────────
const {
  mockCreateTransport,
  mockLogAppend,
  mockLogClear,
  mockLogSetVerbosity,
  mockLogGetEntries,
  mockLogRemoveSession
} = vi.hoisted(() => ({
  mockCreateTransport: vi.fn<() => Promise<SessionTransportResult>>(),
  mockLogAppend: vi.fn(),
  mockLogClear: vi.fn(),
  mockLogSetVerbosity: vi.fn(),
  mockLogGetEntries: vi.fn(() => []),
  mockLogRemoveSession: vi.fn()
}))

vi.mock('./SessionFactory', () => ({
  sessionFactory: { createTransport: mockCreateTransport }
}))

vi.mock('./ConnectionLog', () => ({
  connectionLog: {
    append: mockLogAppend,
    clear: mockLogClear,
    setSessionVerbosity: mockLogSetVerbosity,
    getEntries: mockLogGetEntries,
    removeSession: mockLogRemoveSession
  }
}))

vi.mock('../hosts/HostRepository', () => ({
  hostRepository: {
    getHost: vi.fn(() => null),
    getProfile: vi.fn(() => null)
  }
}))

vi.mock('../services/CredentialResolver', () => ({
  credentialResolver: { resolvePassword: vi.fn(() => Promise.resolve(null)) }
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
import { SessionManager } from './SessionManager'
import { IPC_CHANNELS } from '../../shared/types'

function makeFakeTransport(): ITransport {
  const emitter = new EventEmitter() as ITransport
  emitter.write = vi.fn()
  emitter.resize = vi.fn()
  emitter.disconnect = vi.fn()
  ;(emitter as unknown as { protocol: string }).protocol = 'ssh'
  return emitter
}

function makeTransportResult(
  overrides: Partial<SessionTransportResult> = {}
): SessionTransportResult {
  return {
    transport: makeFakeTransport(),
    protocol: 'ssh',
    title: 'web01',
    ...overrides
  }
}

function makeFakeWindow() {
  const sent: Array<[string, unknown]> = []
  return {
    isDestroyed: () => false,
    webContents: {
      send: vi.fn((channel: string, payload: unknown) => {
        sent.push([channel, payload])
      })
    },
    setTitle: vi.fn(),
    _sent: sent
  }
}

let manager: SessionManager

beforeEach(() => {
  vi.clearAllMocks()
  mockLogAppend.mockReturnValue({ id: 'log-1', sessionId: 'sess', level: 'info', message: '', timestamp: '' })
  manager = new SessionManager()
})

afterEach(() => {
  manager.closeAll()
})

// ── open → connectInBackground success ───────────────────────────────────────
describe('open → successful connect', () => {
  it('returns a connecting SessionInfo immediately', () => {
    mockCreateTransport.mockResolvedValue(makeTransportResult())
    const info = manager.open({ protocol: 'ssh', title: 'web01' })
    expect(info.status).toBe('connecting')
    expect(info.protocol).toBe('ssh')
    expect(info.title).toBe('web01')
    expect(info.id).toBeTruthy()
  })

  it('transitions status to connected after transport resolves', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    mockCreateTransport.mockResolvedValue(makeTransportResult({ title: 'db01' }))
    const info = manager.open({ protocol: 'ssh' })

    // Wait for microtasks
    await vi.waitFor(() =>
      expect(win.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.sessionStatus,
        expect.objectContaining({ id: info.id, status: 'connected' })
      )
    )

    const sessions = manager.list()
    expect(sessions.find((s) => s.id === info.id)?.status).toBe('connected')
  })

  it('attaches transport data events for terminal protocols', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    const transport = makeFakeTransport()
    mockCreateTransport.mockResolvedValue(makeTransportResult({ transport, protocol: 'ssh' }))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')

    // Emitting data should forward it to the window
    transport.emit('data', 'hello')
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.sessionData,
      expect.objectContaining({ id: info.id, data: 'hello' })
    )
  })

  it('does NOT attach data events for non-terminal (rdp) sessions', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    const transport = makeFakeTransport()
    ;(transport as unknown as { protocol: string }).protocol = 'rdp'
    mockCreateTransport.mockResolvedValue(
      makeTransportResult({ transport, protocol: 'rdp', proxyUrl: 'ws://localhost:12345' })
    )
    const info = manager.open({ protocol: 'rdp' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')

    const callsBefore = win.webContents.send.mock.calls.length
    transport.emit('data', 'should-not-forward')
    expect(win.webContents.send.mock.calls.length).toBe(callsBefore)
  })
})

// ── open → connectInBackground failure ───────────────────────────────────────
describe('open → connect failure', () => {
  it('transitions status to error when createTransport rejects', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    mockCreateTransport.mockRejectedValue(new Error('SSH auth failed'))
    const info = manager.open({ protocol: 'ssh' })

    await vi.waitFor(() =>
      expect(win.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.sessionStatus,
        expect.objectContaining({ id: info.id, status: 'error' })
      )
    )
    const session = manager.list().find((s) => s.id === info.id)
    expect(session?.status).toBe('error')
    expect(session?.error).toBe('SSH auth failed')
  })

  it('appends an error log entry on failure', async () => {
    mockCreateTransport.mockRejectedValue(new Error('timeout'))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'error')
    expect(mockLogAppend).toHaveBeenCalledWith(info.id, 'error', 'timeout')
  })
})

// ── reconnect ────────────────────────────────────────────────────────────────
describe('reconnect', () => {
  it('returns null for unknown session id', async () => {
    const result = await manager.reconnect('ghost')
    expect(result).toBeNull()
  })

  it('transitions from error back to connected on successful reconnect', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    mockCreateTransport.mockRejectedValueOnce(new Error('first attempt failed'))
    const info = manager.open({ protocol: 'ssh', title: 'web01' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'error')

    mockCreateTransport.mockResolvedValue(makeTransportResult({ title: 'web01' }))
    const reconnected = await manager.reconnect(info.id)
    expect(reconnected?.status).toBe('connected')
  })

  it('stays in error state when reconnect also fails', async () => {
    const win = makeFakeWindow()
    manager.setWindow(win as unknown as Electron.BrowserWindow)

    mockCreateTransport.mockRejectedValue(new Error('always fails'))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'error')

    const reconnected = await manager.reconnect(info.id)
    expect(reconnected?.status).toBe('error')
  })

  it('clears the log before reconnecting', async () => {
    mockCreateTransport.mockRejectedValueOnce(new Error('err'))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'error')

    mockCreateTransport.mockResolvedValue(makeTransportResult())
    await manager.reconnect(info.id)
    expect(mockLogClear).toHaveBeenCalledWith(info.id)
  })
})

// ── close ─────────────────────────────────────────────────────────────────────
describe('close', () => {
  it('removes session from list', async () => {
    mockCreateTransport.mockResolvedValue(makeTransportResult())
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')
    manager.close(info.id)
    expect(manager.list().find((s) => s.id === info.id)).toBeUndefined()
  })

  it('disconnects transport on close', async () => {
    const transport = makeFakeTransport()
    mockCreateTransport.mockResolvedValue(makeTransportResult({ transport }))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')
    manager.close(info.id)
    expect(transport.disconnect).toHaveBeenCalled()
  })
})

// ── write / resize ────────────────────────────────────────────────────────────
describe('write and resize', () => {
  it('forwards write calls to transport', async () => {
    const transport = makeFakeTransport()
    mockCreateTransport.mockResolvedValue(makeTransportResult({ transport }))
    const info = manager.open({ protocol: 'ssh' })
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')
    manager.write(info.id, 'ls -la\n')
    expect(transport.write).toHaveBeenCalledWith('ls -la\n')
  })

  it('forwards resize calls to transport and updates reconnectMeta', async () => {
    const transport = makeFakeTransport()
    mockCreateTransport.mockResolvedValue(makeTransportResult({ transport }))
    const info = manager.open({ protocol: 'ssh' }, 80, 24)
    await vi.waitFor(() => manager.list().find((s) => s.id === info.id)?.status === 'connected')
    manager.resize(info.id, 120, 40)
    expect(transport.resize).toHaveBeenCalledWith(120, 40)
  })
})
