import { describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { DEFAULT_TERMINAL_APPEARANCE } from '@consoleri/core'
import { applyTerminalOptions, buildTerminalOptions } from './terminalOptions'

describe('buildTerminalOptions', () => {
  it('maps appearance to GPU-friendly xterm options', () => {
    const options = buildTerminalOptions(DEFAULT_TERMINAL_APPEARANCE)

    expect(options.fontSize).toBe(DEFAULT_TERMINAL_APPEARANCE.fontSize)
    expect(options.fontFamily).toBe(DEFAULT_TERMINAL_APPEARANCE.fontFamily)
    expect(options.fontWeight).toBe('normal')
    expect(options.fontWeightBold).toBe('bold')
    expect(options.customGlyphs).toBe(true)
    expect(options.allowProposedApi).toBe(true)
    expect(options.scrollback).toBe(DEFAULT_TERMINAL_APPEARANCE.scrollback)
  })

  it('applies overrides after defaults', () => {
    const options = buildTerminalOptions(DEFAULT_TERMINAL_APPEARANCE, {
      fontSize: 12,
      scrollback: 100,
      disableStdin: true
    })

    expect(options.fontSize).toBe(12)
    expect(options.scrollback).toBe(100)
    expect(options.disableStdin).toBe(true)
    expect(options.customGlyphs).toBe(true)
  })
})

describe('applyTerminalOptions', () => {
  it('updates mutable terminal options from appearance', () => {
    const term = {
      options: {
        theme: {},
        fontSize: 0,
        fontFamily: '',
        fontWeight: '',
        fontWeightBold: '',
        cursorBlink: false,
        customGlyphs: false,
        scrollback: 0
      }
    } as unknown as Terminal

    applyTerminalOptions(term, DEFAULT_TERMINAL_APPEARANCE, { fontSize: 11 })

    expect(term.options.fontSize).toBe(11)
    expect(term.options.fontFamily).toBe(DEFAULT_TERMINAL_APPEARANCE.fontFamily)
    expect(term.options.fontWeight).toBe('normal')
    expect(term.options.fontWeightBold).toBe('bold')
    expect(term.options.customGlyphs).toBe(true)
    expect(term.options.theme).toEqual(DEFAULT_TERMINAL_APPEARANCE.theme)
  })
})
