import { describe, expect, it } from 'vitest'
import { DEFAULT_TERMINAL_APPEARANCE } from './defaults'
import { normalizeTerminalAppearance, normalizeChromeAppearance } from './validate'

describe('normalizeTerminalAppearance', () => {
  it('clamps font size and scrollback', () => {
    const result = normalizeTerminalAppearance({
      fontSize: 4,
      scrollback: 999999,
      fontFamily: '  ',
      cursorBlink: true,
      theme: {}
    })
    expect(result.fontSize).toBe(8)
    expect(result.scrollback).toBe(50000)
    expect(result.fontFamily).toBe(DEFAULT_TERMINAL_APPEARANCE.fontFamily)
  })

  it('rejects invalid theme colors', () => {
    const result = normalizeTerminalAppearance({
      theme: { background: 'not-a-color', foreground: '#AABBCC' }
    })
    expect(result.theme.background).toBe(DEFAULT_TERMINAL_APPEARANCE.theme.background)
    expect(result.theme.foreground).toBe('#aabbcc')
  })
})

describe('normalizeChromeAppearance', () => {
  it('clamps sidebar width', () => {
    expect(normalizeChromeAppearance({ sidebarWidth: 100 }).sidebarWidth).toBe(360)
    expect(normalizeChromeAppearance({ sidebarWidth: 900 }).sidebarWidth).toBe(480)
  })
})
