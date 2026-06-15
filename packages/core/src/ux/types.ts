export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface TerminalAppearance {
  fontSize: number
  fontFamily: string
  cursorBlink: boolean
  scrollback: number
  theme: TerminalTheme
}

export interface ChromeAppearance {
  sidebarWidth: number
}

export interface UxProfile {
  id: string
  name: string
  terminal: TerminalAppearance
  chrome: ChromeAppearance
  isBuiltin: boolean
  createdAt: string
  updatedAt: string
}

export interface UxProfileSettings {
  terminal: TerminalAppearance
  chrome: ChromeAppearance
}

export interface UxProfileInput {
  name: string
  terminal: TerminalAppearance
  chrome: ChromeAppearance
}

export const BUILTIN_UX_PROFILE_ID = 'builtin-github-dark'

export const TERMINAL_THEME_KEYS = [
  'background',
  'foreground',
  'cursor',
  'selectionBackground',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite'
] as const satisfies ReadonlyArray<keyof TerminalTheme>
