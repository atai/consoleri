import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SessionInfo } from '@shared/types'
import { useAutoReconnect } from './useAutoReconnect'

// ── window.consoleri stub ─────────────────────────────────────────────────────
const mockAppendLog = vi.fn().mockResolvedValue(undefined)

function installConsoleri() {
  Object.defineProperty(window, 'consoleri', {
    value: {
      sessions: {
        appendLog: mockAppendLog
      }
    },
    writable: true,
    configurable: true
  })
}

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: 'sess-1',
    protocol: 'ssh',
    title: 'web01',
    status: 'error',
    hostId: null,
    profileId: null,
    ...overrides
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  installConsoleri()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── initial state ─────────────────────────────────────────────────────────────
describe('initial state', () => {
  it('starts disabled with defaults', () => {
    const onConnect = vi.fn()
    const session = makeSession()
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    expect(result.current.autoEnabled).toBe(false)
    expect(result.current.intervalSec).toBe(30)
    expect(result.current.maxAttempts).toBe(0)
    expect(result.current.soundEnabled).toBe(true)
    expect(result.current.attemptsDone).toBe(0)
    expect(result.current.countdown).toBe(30)
  })
})

// ── enable / disable ──────────────────────────────────────────────────────────
describe('enable and disable', () => {
  it('enable sets autoEnabled to true and logs it', () => {
    const onConnect = vi.fn()
    const session = makeSession()
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    act(() => result.current.enable())

    expect(result.current.autoEnabled).toBe(true)
    expect(mockAppendLog).toHaveBeenCalledWith(
      session.id,
      'info',
      expect.stringContaining('Auto-reconnect enabled')
    )
  })

  it('disable sets autoEnabled to false and logs it', () => {
    const session = makeSession()
    const { result } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => result.current.enable())
    act(() => result.current.disable())

    expect(result.current.autoEnabled).toBe(false)
    expect(mockAppendLog).toHaveBeenCalledWith(
      session.id,
      'info',
      'Auto-reconnect stopped by user'
    )
  })

  it('enable includes unlimited-attempts label when maxAttempts is 0', () => {
    const session = makeSession()
    const { result } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => result.current.enable())

    const calls = mockAppendLog.mock.calls
    const enableCall = calls.find((c) => String(c[2]).includes('unlimited attempts'))
    expect(enableCall).toBeTruthy()
  })

  it('enable includes attempt limit when maxAttempts > 0', () => {
    const session = makeSession()
    const { result } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => result.current.setMaxAttempts(3))
    act(() => result.current.enable())

    const calls = mockAppendLog.mock.calls
    const enableCall = calls.find((c) => String(c[2]).includes('max 3 attempt(s)'))
    expect(enableCall).toBeTruthy()
  })
})

// ── countdown timer ───────────────────────────────────────────────────────────
describe('countdown timer', () => {
  it('decrements countdown every second when enabled and session is in error', () => {
    const session = makeSession({ status: 'error' })
    const { result } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => {
      result.current.setIntervalSec(5)
      result.current.enable()
    })

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.countdown).toBe(2)
  })

  it('fires onConnect when countdown reaches zero', () => {
    const onConnect = vi.fn()
    const session = makeSession({ status: 'error' })
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    act(() => {
      result.current.setIntervalSec(3)
      result.current.enable()
    })

    act(() => vi.advanceTimersByTime(3000))
    expect(onConnect).toHaveBeenCalledOnce()
    expect(result.current.attemptsDone).toBe(1)
  })

  it('logs attempt message when reconnect fires', () => {
    const session = makeSession({ status: 'error' })
    const { result } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => {
      result.current.setIntervalSec(2)
      result.current.enable()
    })
    mockAppendLog.mockClear()
    act(() => vi.advanceTimersByTime(2000))

    expect(mockAppendLog).toHaveBeenCalledWith(
      session.id,
      'info',
      expect.stringContaining('Auto-reconnect attempt 1')
    )
  })

  it('does NOT fire timer when not enabled', () => {
    const onConnect = vi.fn()
    const session = makeSession({ status: 'error' })
    renderHook(() => useAutoReconnect(session, onConnect))

    act(() => vi.advanceTimersByTime(60000))
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('does NOT fire timer when session is not in error state', () => {
    const onConnect = vi.fn()
    const session = makeSession({ status: 'connecting' })
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    act(() => {
      result.current.setIntervalSec(2)
      result.current.enable()
    })

    act(() => vi.advanceTimersByTime(5000))
    expect(onConnect).not.toHaveBeenCalled()
  })
})

// ── attempt limit ─────────────────────────────────────────────────────────────
describe('attempt limit', () => {
  it('stops auto-reconnect after maxAttempts is reached', () => {
    const onConnect = vi.fn()
    const session = makeSession({ status: 'error' })
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    act(() => {
      result.current.setIntervalSec(1)
      result.current.setMaxAttempts(2)
      result.current.enable()
    })

    // Fire 2 attempts
    act(() => vi.advanceTimersByTime(2000))
    expect(onConnect).toHaveBeenCalledTimes(2)

    // Attempt 3 should be blocked — autoEnabled goes false, log message fires
    act(() => vi.advanceTimersByTime(1000))
    expect(onConnect).toHaveBeenCalledTimes(2)
    expect(result.current.autoEnabled).toBe(false)

    const limitMsg = mockAppendLog.mock.calls.find((c) =>
      String(c[2]).includes('reached limit of 2')
    )
    expect(limitMsg).toBeTruthy()
  })

  it('fires unlimited attempts when maxAttempts is 0', () => {
    const onConnect = vi.fn()
    const session = makeSession({ status: 'error' })
    const { result } = renderHook(() => useAutoReconnect(session, onConnect))

    act(() => {
      result.current.setIntervalSec(1)
      result.current.setMaxAttempts(0)
      result.current.enable()
    })

    act(() => vi.advanceTimersByTime(5000))
    expect(onConnect).toHaveBeenCalledTimes(5)
    expect(result.current.autoEnabled).toBe(true)
  })
})

// ── session change resets state ───────────────────────────────────────────────
describe('session change resets counters', () => {
  it('resets autoEnabled and attemptsDone when session id changes', () => {
    const session1 = makeSession({ id: 'sess-1', status: 'error' })
    let session = session1

    const { result, rerender } = renderHook(() => useAutoReconnect(session, vi.fn()))

    act(() => {
      result.current.setIntervalSec(1)
      result.current.enable()
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.attemptsDone).toBe(1)

    // Switch to a new session
    session = makeSession({ id: 'sess-2', status: 'connecting' })
    rerender()

    expect(result.current.autoEnabled).toBe(false)
    expect(result.current.attemptsDone).toBe(0)
  })
})
