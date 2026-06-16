import type { ITerminalOptions, Terminal } from '@xterm/xterm'
import type { TerminalAppearance } from '@consoleri/core'

export interface TerminalOptionsOverrides extends Partial<ITerminalOptions> {
  fontSize?: number
}

export function buildTerminalOptions(
  appearance: TerminalAppearance,
  overrides: TerminalOptionsOverrides = {}
): ITerminalOptions {
  const fontSize = overrides.fontSize ?? appearance.fontSize

  return {
    cursorBlink: appearance.cursorBlink,
    fontSize,
    fontFamily: appearance.fontFamily,
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    theme: appearance.theme,
    scrollback: overrides.scrollback ?? appearance.scrollback,
    allowProposedApi: true,
    customGlyphs: true,
    ...overrides
  }
}

export function applyTerminalOptions(
  term: Terminal,
  appearance: TerminalAppearance,
  overrides: TerminalOptionsOverrides = {}
): void {
  const options = buildTerminalOptions(appearance, overrides)
  term.options.theme = options.theme
  term.options.fontSize = options.fontSize
  term.options.fontFamily = options.fontFamily
  term.options.fontWeight = options.fontWeight
  term.options.fontWeightBold = options.fontWeightBold
  term.options.cursorBlink = options.cursorBlink
  term.options.customGlyphs = options.customGlyphs
  if (options.scrollback !== undefined) {
    term.options.scrollback = options.scrollback
  }
}
