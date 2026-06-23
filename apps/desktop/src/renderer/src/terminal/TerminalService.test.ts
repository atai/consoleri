import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TERMINAL_APPEARANCE } from '@consoleri/core'

const termWrite = vi.fn()
const termReset = vi.fn()
const termDispose = vi.fn()
const termLoadAddon = vi.fn()
const fitAddonFit = vi.fn()
const onDataHandlers: Array<(data: string) => void> = []

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

vi.mock('./terminalRenderer', () => ({
  attachTerminalRenderer: vi.fn()
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = fitAddonFit
  }
}))

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    serialize = vi.fn(() => '')
  }
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options = {
      theme: {},
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      cursorBlink: true,
      customGlyphs: true,
      scrollback: 1000
    }

    cols = 80
    rows = 24

    open(): void {}

    write = termWrite
    reset = termReset
    dispose = termDispose
    loadAddon = termLoadAddon

    onData(cb: (data: string) => void): { dispose: () => void } {
      onDataHandlers.push(cb)
      return { dispose: vi.fn() }
    }

    emitData(data: string): void {
      for (const handler of onDataHandlers) {
        handler(data)
      }
    }
  }
}))

import { TerminalService } from './TerminalService'

type DataHandler = (payload: { id: string; data: string }) => void

function installConsoleriMock(): {
  onData: ReturnType<typeof vi.fn<(cb: DataHandler) => () => void>>
  write: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  emitData: (payload: { id: string; data: string }) => void
} {
  let handler: DataHandler | null = null
  const onData = vi.fn((cb: DataHandler) => {
    handler = cb
    return () => {
      handler = null
    }
  })
  const write = vi.fn()
  const resize = vi.fn()

  Object.defineProperty(window, 'consoleri', {
    configurable: true,
    value: {
      sessions: { onData, write, resize, appendLog: vi.fn() },
      clipboard: { readText: vi.fn(), writeText: vi.fn() }
    }
  })

  return {
    onData,
    write,
    resize,
    emitData: (payload) => handler?.(payload)
  }
}

describe('TerminalService', () => {
  let service: TerminalService
  let rafCallbacks: Array<FrameRequestCallback>
  let rafId: number

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0
    termWrite.mockClear()
    termReset.mockClear()
    termDispose.mockClear()
    termLoadAddon.mockClear()
    fitAddonFit.mockClear()
    onDataHandlers.length = 0

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      rafId += 1
      return rafId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    installConsoleriMock()
    service = new TerminalService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  function flushAnimationFrames(): void {
    const pending = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of pending) {
      cb(0)
    }
  }

  it('registers a single IPC data dispatcher for all sessions', () => {
    const api = installConsoleriMock()
    service.acquireTerminal('session-a')
    service.acquireTerminal('session-b')

    expect(api.onData).toHaveBeenCalledTimes(1)
  })

  it('batches mounted session writes into one term.write per animation frame', () => {
    const container = document.createElement('div')

    service.mountTerminal('session-a', container)

    service.enqueueWrite('session-a', 'hello ')
    service.enqueueWrite('session-a', 'world')

    expect(termWrite).not.toHaveBeenCalled()

    flushAnimationFrames()

    expect(termWrite).toHaveBeenCalledTimes(1)
    expect(termWrite).toHaveBeenCalledWith('hello world')
  })

  it('flushes buffered output immediately on mount', () => {
    const container = document.createElement('div')

    service.acquireTerminal('session-a')
    service.enqueueWrite('session-a', 'buffered')
    termWrite.mockClear()

    service.mountTerminal('session-a', container)

    expect(termWrite).toHaveBeenCalledWith('buffered')
  })

  it('routes IPC payloads to the matching session buffer', () => {
    const api = installConsoleriMock()
    const container = document.createElement('div')

    service.mountTerminal('session-a', container)
    termWrite.mockClear()

    api.emitData({ id: 'session-a', data: 'from-ipc' })
    flushAnimationFrames()

    expect(termWrite).toHaveBeenCalledWith('from-ipc')
  })

  it('trims unmounted buffers to the configured cap', () => {
    const container = document.createElement('div')

    service.acquireTerminal('session-a')
    service.enqueueWrite('session-a', 'a'.repeat(700_000))
    service.enqueueWrite('session-a', 'b'.repeat(400_000))
    termWrite.mockClear()

    service.mountTerminal('session-a', container)

    expect(termWrite).toHaveBeenCalledWith('b'.repeat(400_000))
  })

  it('forwards terminal input to sessions.write', () => {
    const api = installConsoleriMock()
    const container = document.createElement('div')

    service.mountTerminal('session-a', container)
    service.attachInput('session-a')

    const entry = service.getTerminal('session-a')!
    ;(entry.term as unknown as { emitData: (data: string) => void }).emitData('ls')

    expect(api.write).toHaveBeenCalledWith('session-a', 'ls')
  })

  it('applies appearance updates to pooled terminals', () => {
    const container = document.createElement('div')

    const entry = service.mountTerminal('session-a', container, DEFAULT_TERMINAL_APPEARANCE)
    const nextAppearance = {
      ...DEFAULT_TERMINAL_APPEARANCE,
      fontSize: 18,
      fontFamily: 'Courier New'
    }

    service.applyAppearance('session-a', nextAppearance)

    expect(entry.term.options.fontSize).toBe(18)
    expect(entry.term.options.fontFamily).toBe('Courier New')
  })

  it('restoreScrollback clears pending writes before replaying data', () => {
    service.acquireTerminal('session-a')
    service.enqueueWrite('session-a', 'stale')
    termWrite.mockClear()
    termReset.mockClear()

    service.restoreScrollback('session-a', 'restored')

    expect(termReset).toHaveBeenCalled()
    expect(termWrite).toHaveBeenCalledWith('restored')
    expect(termWrite).not.toHaveBeenCalledWith('stale')
  })
})
