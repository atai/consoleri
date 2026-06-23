import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SessionInfo } from '@shared/types'
import { attachInputHandlers } from './useRdpConnection'
import type { IronRdpInputApi } from './useRdpConnection'

// ── attachInputHandlers: event registration / cleanup ─────────────────────────
//
// Tests that attachInputHandlers registers all required event listeners on
// the canvas element and that calling the returned cleanup function removes
// each one — following the rdpInput.test.ts style with plain DOM objects.

function makeIronRdpApi(): IronRdpInputApi {
  const applyInputs = vi.fn()

  const DeviceEvent = {
    keyPressed: vi.fn(() => ({ type: 'keyPressed' })),
    keyReleased: vi.fn(() => ({ type: 'keyReleased' })),
    mouseMove: vi.fn(() => ({ type: 'mouseMove' })),
    mouseButtonPressed: vi.fn(() => ({ type: 'mouseButtonPressed' })),
    mouseButtonReleased: vi.fn(() => ({ type: 'mouseButtonReleased' })),
    wheelRotations: vi.fn(() => ({ type: 'wheelRotations' }))
  }

  const InputTransaction = vi.fn().mockImplementation(() => ({
    addEvent: vi.fn(),
    _apply: applyInputs
  }))

  const RotationUnit = { Line: 'line', Pixel: 'pixel' }

  return {
    DeviceEvent: DeviceEvent as unknown as IronRdpInputApi['DeviceEvent'],
    InputTransaction: InputTransaction as unknown as IronRdpInputApi['InputTransaction'],
    RotationUnit: RotationUnit as unknown as IronRdpInputApi['RotationUnit']
  }
}

function makeCanvas() {
  const listeners = new Map<string, EventListener[]>()
  const canvas = {
    tabIndex: 0,
    style: { cursor: '' },
    width: 1280,
    height: 720,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      const list = listeners.get(type) ?? []
      list.push(handler)
      listeners.set(type, list)
    }),
    removeEventListener: vi.fn((type: string, handler: EventListener) => {
      const list = listeners.get(type) ?? []
      listeners.set(type, list.filter((h) => h !== handler))
    }),
    _listeners: listeners
  }
  return canvas as unknown as HTMLCanvasElement & { _listeners: Map<string, EventListener[]> }
}

describe('attachInputHandlers: event registration', () => {
  it('registers all expected event types on the canvas', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const getSession = () => null

    attachInputHandlers(canvas, getSession, api)

    const registered = vi.mocked(canvas.addEventListener).mock.calls.map((c) => c[0])
    expect(registered).toContain('keydown')
    expect(registered).toContain('keyup')
    expect(registered).toContain('mousemove')
    expect(registered).toContain('mousedown')
    expect(registered).toContain('mouseup')
    expect(registered).toContain('wheel')
    expect(registered).toContain('contextmenu')
  })

  it('sets tabIndex = 0 to make canvas focusable', () => {
    const canvas = makeCanvas()
    attachInputHandlers(canvas, () => null, makeIronRdpApi())
    expect(canvas.tabIndex).toBe(0)
  })
})

describe('attachInputHandlers: cleanup removes all listeners', () => {
  it('cleanup function removes all registered event listeners', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()

    const cleanup = attachInputHandlers(canvas, () => null, api)
    cleanup()

    const removedTypes = vi.mocked(canvas.removeEventListener).mock.calls.map((c) => c[0])
    expect(removedTypes).toContain('keydown')
    expect(removedTypes).toContain('keyup')
    expect(removedTypes).toContain('mousemove')
    expect(removedTypes).toContain('mousedown')
    expect(removedTypes).toContain('mouseup')
    expect(removedTypes).toContain('wheel')
    expect(removedTypes).toContain('contextmenu')
  })
})

describe('attachInputHandlers: input event forwarding', () => {
  it('calls DeviceEvent.keyPressed with resolved scancode on keydown', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }
    const getSession = () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession

    attachInputHandlers(canvas, getSession, api)

    const handlers = canvas._listeners.get('keydown') ?? []
    expect(handlers).toHaveLength(1)

    const event = new KeyboardEvent('keydown', { code: 'Enter' })
    handlers[0](event)

    expect(api.DeviceEvent.keyPressed).toHaveBeenCalled()
  })

  it('calls session.applyInputs with an InputTransaction on keydown when session is active', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('keydown') ?? []
    handlers[0](new KeyboardEvent('keydown', { code: 'Enter' }))

    expect(fakeSession.applyInputs).toHaveBeenCalledOnce()
  })

  it('does not forward keydown for unknown key codes', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('keydown') ?? []

    handlers[0](new KeyboardEvent('keydown', { code: 'UnknownKey12345' }))
    expect(api.DeviceEvent.keyPressed).not.toHaveBeenCalled()
  })

  it('calls DeviceEvent.keyReleased with resolved scancode on keyup', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('keyup') ?? []
    expect(handlers).toHaveLength(1)

    handlers[0](new KeyboardEvent('keyup', { code: 'KeyA' }))
    expect(api.DeviceEvent.keyReleased).toHaveBeenCalled()
    expect(fakeSession.applyInputs).toHaveBeenCalledOnce()
  })

  it('does not forward keyup for unknown key codes', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()

    attachInputHandlers(canvas, () => null, api)
    const handlers = canvas._listeners.get('keyup') ?? []

    handlers[0](new KeyboardEvent('keyup', { code: 'UnknownKey99' }))
    expect(api.DeviceEvent.keyReleased).not.toHaveBeenCalled()
  })

  it('calls DeviceEvent.mouseMove on mousemove', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('mousemove') ?? []

    handlers[0](new MouseEvent('mousemove', { clientX: 100, clientY: 200 }))
    expect(api.DeviceEvent.mouseMove).toHaveBeenCalled()
  })

  it('calls DeviceEvent.mouseButtonPressed and canvas.focus on mousedown', () => {
    const canvas = makeCanvas()
    ;(canvas as unknown as { focus: ReturnType<typeof vi.fn> }).focus = vi.fn()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('mousedown') ?? []

    handlers[0](new MouseEvent('mousedown', { button: 0 }))
    expect(api.DeviceEvent.mouseButtonPressed).toHaveBeenCalledWith(0)
    expect((canvas as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled()
  })

  it('calls DeviceEvent.mouseButtonReleased on mouseup', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('mouseup') ?? []

    handlers[0](new MouseEvent('mouseup', { button: 2 }))
    expect(api.DeviceEvent.mouseButtonReleased).toHaveBeenCalledWith(2)
    expect(fakeSession.applyInputs).toHaveBeenCalledOnce()
  })

  it('calls DeviceEvent.wheelRotations(true) on vertical wheel', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('wheel') ?? []

    handlers[0](new WheelEvent('wheel', { deltaY: 120, deltaX: 0 }))
    expect(api.DeviceEvent.wheelRotations).toHaveBeenCalledWith(true, expect.any(Number), expect.anything())
    expect(fakeSession.applyInputs).toHaveBeenCalledOnce()
  })

  it('calls DeviceEvent.wheelRotations(false) on horizontal wheel', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('wheel') ?? []

    handlers[0](new WheelEvent('wheel', { deltaY: 0, deltaX: 80 }))
    expect(api.DeviceEvent.wheelRotations).toHaveBeenCalledWith(false, expect.any(Number), expect.anything())
  })

  it('fires two wheelRotations events when both deltaX and deltaY are non-zero', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()
    const fakeSession = { applyInputs: vi.fn() }

    attachInputHandlers(canvas, () => fakeSession as unknown as import('ironrdp-wasm').IronRdpSession, api)
    const handlers = canvas._listeners.get('wheel') ?? []

    handlers[0](new WheelEvent('wheel', { deltaY: 120, deltaX: 80 }))
    expect(api.DeviceEvent.wheelRotations).toHaveBeenCalledTimes(2)
    expect(fakeSession.applyInputs).toHaveBeenCalledTimes(2)
  })

  it('does not fire wheelRotations when deltaX and deltaY are both zero', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()

    attachInputHandlers(canvas, () => null, api)
    const handlers = canvas._listeners.get('wheel') ?? []

    handlers[0](new WheelEvent('wheel', { deltaY: 0, deltaX: 0 }))
    expect(api.DeviceEvent.wheelRotations).not.toHaveBeenCalled()
  })

  it('contextmenu handler calls preventDefault without throwing', () => {
    const canvas = makeCanvas()
    attachInputHandlers(canvas, () => null, makeIronRdpApi())

    const handlers = canvas._listeners.get('contextmenu') ?? []
    const event = new MouseEvent('contextmenu')
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    expect(() => handlers[0](event)).not.toThrow()
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('does not forward events when session is null', () => {
    const canvas = makeCanvas()
    const api = makeIronRdpApi()

    attachInputHandlers(canvas, () => null, api)
    const handlers = canvas._listeners.get('keydown') ?? []

    handlers[0](new KeyboardEvent('keydown', { code: 'Enter' }))
    expect(api.DeviceEvent.keyPressed).toHaveBeenCalled()
    // applyEvent returns early when session is null — no InputTransaction created
    expect(api.InputTransaction).not.toHaveBeenCalled()
  })
})

// ── useRdpConnection: credential fetch lifecycle ──────────────────────────────

vi.mock('./ironrdpInit', () => ({
  ensureIronRdpReady: vi.fn().mockResolvedValue({}),
  formatIronError: vi.fn((err: unknown) => String(err))
}))
vi.mock('./rdpErrors', () => ({
  logRdpError: vi.fn()
}))

const mockGetRdpCredentials = vi.fn()

function installConsoleriRdp() {
  Object.defineProperty(window, 'consoleri', {
    value: {
      sessions: {
        getRdpCredentials: mockGetRdpCredentials,
        appendLog: vi.fn().mockResolvedValue(undefined)
      }
    },
    writable: true,
    configurable: true
  })
}

import { useRdpConnection } from './useRdpConnection'

beforeEach(() => {
  vi.clearAllMocks()
  installConsoleriRdp()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRdpConnection: credential fetch', () => {
  it('fetches credentials when profileId is provided', async () => {
    const creds = { username: 'admin', password: 'pw' }
    mockGetRdpCredentials.mockResolvedValue(creds)

    const session: SessionInfo = {
      id: 'sess-1',
      protocol: 'rdp',
      title: 'rdp-host',
      status: 'connected',
      hostId: null,
      profileId: 'prof-1',
      proxyUrl: undefined
    }
    const containerRef = { current: null }

    renderHook(() =>
      useRdpConnection({ session, profileId: 'prof-1', containerRef })
    )

    await vi.waitFor(() =>
      expect(mockGetRdpCredentials).toHaveBeenCalledWith('prof-1')
    )
  })

  it('falls back to empty credentials when profileId is absent', async () => {
    const session: SessionInfo = {
      id: 'sess-2',
      protocol: 'rdp',
      title: 'rdp-host',
      status: 'connected',
      hostId: null,
      profileId: null
    }
    const containerRef = { current: null }

    renderHook(() =>
      useRdpConnection({ session, profileId: null, containerRef })
    )

    // No credentials call when no profileId
    await act(async () => {})
    expect(mockGetRdpCredentials).not.toHaveBeenCalled()
  })

  it('initial status is idle', () => {
    const session: SessionInfo = {
      id: 'sess-3',
      protocol: 'rdp',
      title: 'rdp',
      status: 'connected',
      hostId: null,
      profileId: null
    }
    const { result } = renderHook(() =>
      useRdpConnection({ session, profileId: null, containerRef: { current: null } })
    )
    expect(result.current.status).toBe('idle')
  })
})
