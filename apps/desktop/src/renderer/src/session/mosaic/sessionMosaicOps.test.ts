import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionInfo } from '@shared/types'

// ── store stubs ───────────────────────────────────────────────────────────────
const { mockGetState } = vi.hoisted(() => ({ mockGetState: vi.fn() }))

vi.mock('../../stores/preferencesStore', () => ({
  usePreferencesStore: { getState: mockGetState }
}))

vi.mock('../../stores/appStore', () => ({
  useAppStore: { getState: vi.fn() },
  flushWorkspacePersist: vi.fn()
}))

vi.mock('../../terminal/TerminalPool', () => ({ releaseTerminal: vi.fn() }))

// ── window.consoleri stub ─────────────────────────────────────────────────────
function makeConsoleri(overrides?: Partial<{ sessions: Record<string, ReturnType<typeof vi.fn>> }>) {
  return {
    sessions: {
      open: vi.fn(),
      openLogWindow: vi.fn(),
      close: vi.fn(),
      reconnect: vi.fn(),
      ...overrides?.sessions
    },
    workspace: { save: vi.fn().mockResolvedValue(undefined) }
  }
}

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
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

function makePreferencesState(overrides: object = {}) {
  return {
    settings: { autoOpenConnectionLog: false, sessionOpenMode: 'workspace' },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetState.mockReturnValue(makePreferencesState())
  vi.stubGlobal('alert', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── imports after stubs ───────────────────────────────────────────────────────
import {
  createPaneBinding,
  insertPane,
  splitMosaicPane,
  reconnectMosaicPane
} from './sessionMosaicOps'
import type { PaneBinding } from '@shared/types'

// ── createPaneBinding ─────────────────────────────────────────────────────────
describe('createPaneBinding', () => {
  it('creates a binding with a fresh paneId', () => {
    const session = makeSession({ id: 'sess-42', protocol: 'rdp', title: 'win01' })
    const request = { hostId: 'h1', profileId: 'p1', protocol: 'rdp' as const }
    const binding = createPaneBinding(session, request)

    expect(binding.paneId).toBeTruthy()
    expect(binding.sessionId).toBe('sess-42')
    expect(binding.protocol).toBe('rdp')
    expect(binding.title).toBe('win01')
    expect(binding.connectRequest).toEqual(request)
  })

  it('each call produces a unique paneId', () => {
    const session = makeSession()
    const request = { protocol: 'ssh' as const }
    const b1 = createPaneBinding(session, request)
    const b2 = createPaneBinding(session, request)
    expect(b1.paneId).not.toBe(b2.paneId)
  })

  it('connectRequest is a shallow copy, not the same reference', () => {
    const session = makeSession()
    const request = { hostId: 'h1', protocol: 'ssh' as const }
    const binding = createPaneBinding(session, request)
    expect(binding.connectRequest).toEqual(request)
    expect(binding.connectRequest).not.toBe(request)
  })
})

// ── insertPane ────────────────────────────────────────────────────────────────
describe('insertPane', () => {
  it('inserts into null layout producing a single leaf', () => {
    const session = makeSession()
    const binding = createPaneBinding(session, { protocol: 'ssh' as const })
    const { layout, panes } = insertPane(null, [], binding)

    expect(layout).toBe(binding.paneId)
    expect(panes).toHaveLength(1)
    expect(panes[0]).toBe(binding)
  })

  it('inserts into an existing layout producing a split node', () => {
    const session1 = makeSession({ id: 's1' })
    const session2 = makeSession({ id: 's2' })
    const b1 = createPaneBinding(session1, { protocol: 'ssh' as const })
    const b2 = createPaneBinding(session2, { protocol: 'ssh' as const })

    const { layout: layout1, panes: panes1 } = insertPane(null, [], b1)
    const { layout: layout2, panes: panes2 } = insertPane(layout1, panes1, b2)

    expect(typeof layout2).toBe('object')
    expect(panes2).toHaveLength(2)
    expect(panes2[1]).toBe(b2)
  })

  it('does not mutate the original panes array', () => {
    const session = makeSession()
    const binding = createPaneBinding(session, { protocol: 'ssh' as const })
    const original: PaneBinding[] = []
    const { panes } = insertPane(null, original, binding)

    expect(original).toHaveLength(0)
    expect(panes).toHaveLength(1)
  })
})

// ── splitMosaicPane ───────────────────────────────────────────────────────────
describe('splitMosaicPane', () => {
  it('returns null when sourcePaneId not found', async () => {
    const consoleri = makeConsoleri()
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const result = await splitMosaicPane('pane-1', [], 'missing-pane', 'row')
    expect(result).toBeNull()
  })

  it('returns null when layout is null', async () => {
    const consoleri = makeConsoleri()
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const session = makeSession()
    const binding = createPaneBinding(session, { protocol: 'ssh' as const })
    const result = await splitMosaicPane(null, [binding], binding.paneId, 'row')
    expect(result).toBeNull()
  })

  it('opens a new session and returns split layout on success', async () => {
    const newSession = makeSession({ id: 'sess-new', status: 'connecting' })
    const consoleri = makeConsoleri({ sessions: { open: vi.fn().mockResolvedValue(newSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const existingSession = makeSession({ id: 'sess-1' })
    const binding = createPaneBinding(existingSession, { hostId: 'h1', protocol: 'ssh' as const })
    const { layout: existingLayout, panes: existingPanes } = insertPane(null, [], binding)

    const result = await splitMosaicPane(existingLayout, existingPanes, binding.paneId, 'row')

    expect(result).not.toBeNull()
    expect(result!.panes).toHaveLength(2)
    expect(result!.sessions).toHaveLength(1)
    expect(result!.sessions[0].id).toBe('sess-new')
    expect(typeof result!.layout).toBe('object')
  })

  it('returns null when the new session fails', async () => {
    const errorSession = makeSession({ id: 'sess-err', status: 'error', error: 'Connection refused' })
    const consoleri = makeConsoleri({ sessions: { open: vi.fn().mockResolvedValue(errorSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const existingSession = makeSession({ id: 'sess-1' })
    const binding = createPaneBinding(existingSession, { protocol: 'ssh' as const })
    const { layout: existingLayout, panes: existingPanes } = insertPane(null, [], binding)

    const result = await splitMosaicPane(existingLayout, existingPanes, binding.paneId, 'column')
    expect(result).toBeNull()
  })

  it('passes the source connect request to the new session', async () => {
    const newSession = makeSession({ id: 'sess-new', status: 'connecting' })
    const mockOpen = vi.fn().mockResolvedValue(newSession)
    const consoleri = makeConsoleri({ sessions: { open: mockOpen } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const existingSession = makeSession()
    const connectRequest = { hostId: 'h1', profileId: 'p1', protocol: 'ssh' as const }
    const binding = createPaneBinding(existingSession, connectRequest)
    const { layout, panes } = insertPane(null, [], binding)

    await splitMosaicPane(layout, panes, binding.paneId, 'row')
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'h1', profileId: 'p1' }))
  })
})

// ── reconnectMosaicPane ───────────────────────────────────────────────────────
describe('reconnectMosaicPane', () => {
  it('returns null when paneId not found', async () => {
    const result = await reconnectMosaicPane([], 'missing-pane')
    expect(result).toBeNull()
  })

  it('calls sessions.reconnect when binding has a sessionId', async () => {
    const reconSession = makeSession({ id: 'sess-1', status: 'connected' })
    const consoleri = makeConsoleri({ sessions: { reconnect: vi.fn().mockResolvedValue(reconSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const binding: PaneBinding = {
      paneId: 'pane-1',
      sessionId: 'sess-1',
      protocol: 'ssh',
      title: 'web01',
      connectRequest: { protocol: 'ssh' }
    }

    const result = await reconnectMosaicPane([binding], 'pane-1')
    expect(consoleri.sessions.reconnect).toHaveBeenCalledWith('sess-1')
    expect(result).not.toBeNull()
    expect(result!.session.id).toBe('sess-1')
  })

  it('calls sessions.open when binding has no sessionId', async () => {
    const newSession = makeSession({ id: 'sess-fresh', status: 'connecting' })
    const consoleri = makeConsoleri({ sessions: { open: vi.fn().mockResolvedValue(newSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const binding: PaneBinding = {
      paneId: 'pane-1',
      sessionId: null,
      protocol: 'ssh',
      title: 'web01',
      connectRequest: { hostId: 'h1', protocol: 'ssh' }
    }

    const result = await reconnectMosaicPane([binding], 'pane-1')
    expect(consoleri.sessions.open).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'h1' }))
    expect(result).not.toBeNull()
    expect(result!.session.id).toBe('sess-fresh')
  })

  it('updates paneId entry with new sessionId, title, protocol', async () => {
    const updatedSession = makeSession({ id: 'sess-2', title: 'db01', protocol: 'rdp', status: 'connected' })
    const consoleri = makeConsoleri({ sessions: { reconnect: vi.fn().mockResolvedValue(updatedSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const panes: PaneBinding[] = [
      { paneId: 'pane-1', sessionId: 'sess-old', protocol: 'ssh', title: 'old', connectRequest: {} },
      { paneId: 'pane-2', sessionId: 'sess-2', protocol: 'rdp', title: 'db01', connectRequest: {} }
    ]

    const result = await reconnectMosaicPane(panes, 'pane-1')
    expect(result).not.toBeNull()
    const updated = result!.panes.find((p) => p.paneId === 'pane-1')!
    expect(updated.sessionId).toBe('sess-2')
    expect(updated.title).toBe('db01')
    expect(updated.protocol).toBe('rdp')
    // Other panes untouched
    expect(result!.panes.find((p) => p.paneId === 'pane-2')).toEqual(panes[1])
  })

  it('returns null when reconnect returns null', async () => {
    const consoleri = makeConsoleri({ sessions: { reconnect: vi.fn().mockResolvedValue(null) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const binding: PaneBinding = {
      paneId: 'pane-1',
      sessionId: 'sess-old',
      protocol: 'ssh',
      title: 'web01',
      connectRequest: {}
    }

    const result = await reconnectMosaicPane([binding], 'pane-1')
    expect(result).toBeNull()
  })

  it('does not mutate original panes array', async () => {
    const reconSession = makeSession({ id: 'sess-new', status: 'connected' })
    const consoleri = makeConsoleri({ sessions: { reconnect: vi.fn().mockResolvedValue(reconSession) } as never })
    Object.defineProperty(window, 'consoleri', { value: consoleri, writable: true, configurable: true })

    const original: PaneBinding[] = [
      { paneId: 'pane-1', sessionId: 'sess-old', protocol: 'ssh', title: 'web01', connectRequest: {} }
    ]
    const originalSnapshot = [...original]

    await reconnectMosaicPane(original, 'pane-1')
    expect(original).toEqual(originalSnapshot)
  })
})
