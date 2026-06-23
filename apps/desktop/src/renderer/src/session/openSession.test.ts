import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionInfo } from '@shared/types'

// ── appStore stub ─────────────────────────────────────────────────────────────
const { mockAddSession, mockGetState } = vi.hoisted(() => ({
  mockAddSession: vi.fn(),
  mockGetState: vi.fn()
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: {
    getState: mockGetState
  },
  flushWorkspacePersist: vi.fn()
}))

// ── TerminalPool stub ─────────────────────────────────────────────────────────
vi.mock('../terminal/TerminalPool', () => ({
  releaseTerminal: vi.fn()
}))

// ── window.consoleri mock helpers ─────────────────────────────────────────────
type MockConsoleri = {
  sessions: {
    open: ReturnType<typeof vi.fn>
    openLogWindow: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    reconnect: ReturnType<typeof vi.fn>
  }
  workspace: {
    save: ReturnType<typeof vi.fn>
  }
}

function makeMockConsoleri(sessionOverrides?: Partial<SessionInfo>): MockConsoleri {
  return {
    sessions: {
      open: vi.fn(),
      openLogWindow: vi.fn(),
      close: vi.fn(),
      reconnect: vi.fn()
    },
    workspace: {
      save: vi.fn().mockResolvedValue(undefined)
    },
    ...sessionOverrides
  }
}

function makeSessionInfo(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: 'sess-1',
    protocol: 'ssh',
    title: 'web01',
    status: 'connecting',
    hostId: null,
    profileId: null,
    ...overrides
  }
}

function makeAppState(overrides: object = {}) {
  return {
    addSession: mockAddSession,
    settings: { autoOpenConnectionLog: false, sessionOpenMode: 'workspace' },
    workspace: { layout: null, panes: [] },
    persistWorkspace: vi.fn(),
    removeSession: vi.fn(),
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetState.mockReturnValue(makeAppState())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── openSession ───────────────────────────────────────────────────────────────
import { openSession } from './openSession'

function stubConsoleri(api: MockConsoleri) {
  vi.stubGlobal('alert', vi.fn())
  Object.defineProperty(window, 'consoleri', { value: api, writable: true, configurable: true })
}

describe('openSession', () => {
  it('returns the session and calls addSession on success', async () => {
    const session = makeSessionInfo({ status: 'connecting' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    stubConsoleri(api)

    const result = await openSession({ protocol: 'ssh', hostId: 'h1' })
    expect(result).toEqual(session)
    expect(mockAddSession).toHaveBeenCalledWith(session)
  })

  it('returns null and shows alert when session status is error', async () => {
    const session = makeSessionInfo({ status: 'error', error: 'Auth failed' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    vi.stubGlobal('alert', vi.fn())
    stubConsoleri(api)

    const result = await openSession({ protocol: 'ssh' })
    expect(result).toBeNull()
    expect(mockAddSession).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('Auth failed')
  })

  it('opens log window on error when autoOpenConnectionLog is true', async () => {
    const session = makeSessionInfo({ status: 'error' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    mockGetState.mockReturnValue(
      makeAppState({ settings: { autoOpenConnectionLog: true, sessionOpenMode: 'workspace' } })
    )
    stubConsoleri(api)

    await openSession({ protocol: 'ssh' })
    expect(api.sessions.openLogWindow).toHaveBeenCalledWith(session.id)
  })

  it('opens log window when connecting and autoOpenConnectionLog is true', async () => {
    const session = makeSessionInfo({ status: 'connecting' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    mockGetState.mockReturnValue(
      makeAppState({ settings: { autoOpenConnectionLog: true, sessionOpenMode: 'workspace' } })
    )
    stubConsoleri(api)

    await openSession({ protocol: 'ssh' })
    expect(api.sessions.openLogWindow).toHaveBeenCalledWith(session.id)
  })

  it('does NOT open log window when autoOpenConnectionLog is false', async () => {
    const session = makeSessionInfo({ status: 'connecting' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    stubConsoleri(api)

    await openSession({ protocol: 'ssh' })
    expect(api.sessions.openLogWindow).not.toHaveBeenCalled()
  })
})

// ── openMosaicSession (sessionMosaicOps) ──────────────────────────────────────
import { openMosaicSession } from './mosaic/sessionMosaicOps'

describe('openMosaicSession', () => {
  it('returns the session on success', async () => {
    const session = makeSessionInfo({ status: 'connecting' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    stubConsoleri(api)

    const result = await openMosaicSession({ protocol: 'ssh' })
    expect(result).toEqual(session)
  })

  it('returns null and shows alert on error status', async () => {
    const session = makeSessionInfo({ status: 'error', error: 'Connection refused' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)
    vi.stubGlobal('alert', vi.fn())
    stubConsoleri(api)

    const result = await openMosaicSession({ protocol: 'ssh' })
    expect(result).toBeNull()
    expect(window.alert).toHaveBeenCalledWith('Connection refused')
  })

  it('opens log window on error when autoOpenConnectionLog setting is true', async () => {
    // openMosaicSession reads from localStorage, not the store
    const session = makeSessionInfo({ status: 'error' })
    const api = makeMockConsoleri()
    api.sessions.open.mockResolvedValue(session)

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ autoOpenConnectionLog: true })),
      setItem: vi.fn(),
      removeItem: vi.fn()
    })
    vi.stubGlobal('alert', vi.fn())
    stubConsoleri(api)

    await openMosaicSession({ protocol: 'ssh' })
    expect(api.sessions.openLogWindow).toHaveBeenCalledWith(session.id)
  })
})
