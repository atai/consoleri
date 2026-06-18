import type { ChromeAppearance, TerminalAppearance, TerminalTheme, UxProfile } from './types'
import { BUILTIN_UX_PROFILE_ID } from './types'

export const DEFAULT_TERMINAL_THEME: TerminalTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc'
}

export const DEFAULT_TERMINAL_APPEARANCE: TerminalAppearance = {
  fontSize: 13,
  fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
  cursorBlink: true,
  scrollback: 10000,
  theme: DEFAULT_TERMINAL_THEME,
  shellPrompt: 'consoleri'
}

export const MIN_SIDEBAR_WIDTH = 360
export const MAX_SIDEBAR_WIDTH = 480

export const DEFAULT_CHROME_APPEARANCE: ChromeAppearance = {
  sidebarWidth: 360
}

export function createBuiltinUxProfile(now = new Date().toISOString()): UxProfile {
  return {
    id: BUILTIN_UX_PROFILE_ID,
    name: 'GitHub Dark',
    terminal: DEFAULT_TERMINAL_APPEARANCE,
    chrome: DEFAULT_CHROME_APPEARANCE,
    isBuiltin: true,
    createdAt: now,
    updatedAt: now
  }
}
