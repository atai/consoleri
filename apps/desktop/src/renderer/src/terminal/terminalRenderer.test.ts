import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'
import { attachTerminalRenderer } from './terminalRenderer'

let webglCtorShouldThrow = false
let canvasCtorShouldThrow = false
let contextLossHandler: (() => void) | null = null

const mockWebglDispose = vi.fn()

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    constructor() {
      if (webglCtorShouldThrow) throw new Error('webgl unavailable')
    }

    onContextLoss(cb: () => void): void {
      contextLossHandler = cb
    }

    dispose(): void {
      mockWebglDispose()
    }
  }
}))

vi.mock('@xterm/addon-canvas', () => ({
  CanvasAddon: class {
    constructor() {
      if (canvasCtorShouldThrow) throw new Error('canvas unavailable')
    }
  }
}))

function createTerm(): Terminal {
  return { loadAddon: vi.fn() } as unknown as Terminal
}

describe('attachTerminalRenderer', () => {
  const appendLog = vi.fn()
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    webglCtorShouldThrow = false
    canvasCtorShouldThrow = false
    contextLossHandler = null
    mockWebglDispose.mockClear()
    appendLog.mockClear()
    warnSpy.mockClear()
    errorSpy.mockClear()

    Object.defineProperty(window, 'consoleri', {
      configurable: true,
      value: { sessions: { appendLog } }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads WebGL renderer when available', () => {
    const term = createTerm()

    attachTerminalRenderer(term, 'session-a')

    expect(term.loadAddon).toHaveBeenCalledTimes(1)
    expect(term.loadAddon).toHaveBeenCalledWith(expect.any(WebglAddon))
    expect(appendLog).not.toHaveBeenCalled()
  })

  it('logs and falls back to canvas when WebGL init fails', () => {
    webglCtorShouldThrow = true
    const term = createTerm()

    attachTerminalRenderer(term, 'session-a')

    expect(warnSpy).toHaveBeenCalledWith(
      'Terminal renderer: WebGL unavailable, falling back to canvas',
      expect.any(Error)
    )
    expect(appendLog).toHaveBeenCalledWith(
      'session-a',
      'warn',
      'Terminal renderer: WebGL unavailable, falling back to canvas'
    )
    expect(term.loadAddon).toHaveBeenCalledTimes(1)
    expect(term.loadAddon).toHaveBeenCalledWith(expect.any(CanvasAddon))
  })

  it('logs and falls back to canvas on WebGL context loss', () => {
    const term = createTerm()

    attachTerminalRenderer(term, 'session-a')
    contextLossHandler?.()

    expect(mockWebglDispose).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      'Terminal renderer: WebGL context lost, falling back to canvas',
      ''
    )
    expect(appendLog).toHaveBeenCalledWith(
      'session-a',
      'warn',
      'Terminal renderer: WebGL context lost, falling back to canvas'
    )
    expect(term.loadAddon).toHaveBeenCalledTimes(2)
    expect(term.loadAddon).toHaveBeenLastCalledWith(expect.any(CanvasAddon))
  })

  it('logs error when canvas fallback also fails', () => {
    webglCtorShouldThrow = true
    canvasCtorShouldThrow = true
    const term = createTerm()

    attachTerminalRenderer(term, 'session-a')

    expect(errorSpy).toHaveBeenCalledWith(
      'Terminal renderer: canvas unavailable, using DOM renderer',
      expect.any(Error)
    )
    expect(appendLog).toHaveBeenCalledWith(
      'session-a',
      'error',
      'Terminal renderer: canvas unavailable, using DOM renderer'
    )
    expect(term.loadAddon).not.toHaveBeenCalled()
  })
})
