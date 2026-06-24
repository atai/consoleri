import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { attachClipboardHandlers } from './clipboard'

describe('attachClipboardHandlers', () => {
  let keyHandler: ((event: KeyboardEvent) => boolean) | undefined
  const paste = vi.fn()
  const readText = vi.fn(async () => 'hello')
  let container: HTMLDivElement

  beforeEach(() => {
    keyHandler = undefined
    paste.mockClear()
    readText.mockClear()
    container = document.createElement('div')

    window.consoleri = {
      clipboard: {
        readText,
        writeText: vi.fn()
      }
    } as unknown as typeof window.consoleri
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function installHandlers(): () => void {
    const term = {
      paste,
      getSelection: () => '',
      hasSelection: () => false,
      attachCustomKeyEventHandler: (handler: (event: KeyboardEvent) => boolean) => {
        keyHandler = handler
      }
    } as unknown as Terminal

    return attachClipboardHandlers(term, container).dispose
  }

  it('pastes once on Ctrl+V and blocks the native paste event', async () => {
    const dispose = installHandlers()
    expect(keyHandler).toBeTypeOf('function')

    const event = new KeyboardEvent('keydown', {
      key: 'v',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    const stopPropagation = vi.spyOn(event, 'stopPropagation')

    expect(keyHandler!(event)).toBe(false)
    expect(preventDefault).toHaveBeenCalled()
    expect(stopPropagation).toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(1)
      expect(paste).toHaveBeenCalledTimes(1)
      expect(paste).toHaveBeenCalledWith('hello')
    })

    dispose()
  })
})
