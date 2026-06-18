import {
  DEFAULT_CHROME_APPEARANCE,
  DEFAULT_TERMINAL_APPEARANCE,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH
} from './defaults'
import type {
  ChromeAppearance,
  TerminalAppearance,
  TerminalTheme,
  UxProfileInput,
  UxProfileSettings
} from './types'
import { TERMINAL_THEME_KEYS } from './types'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOR.test(value)) return value.toLowerCase()
  return fallback
}

export function normalizeTerminalTheme(
  input: Partial<TerminalTheme> | undefined,
  base: TerminalTheme = DEFAULT_TERMINAL_APPEARANCE.theme
): TerminalTheme {
  const theme = { ...base }
  for (const key of TERMINAL_THEME_KEYS) {
    theme[key] = normalizeColor(input?.[key], base[key])
  }
  return theme
}

export function normalizeTerminalAppearance(
  input: Partial<TerminalAppearance> | undefined
): TerminalAppearance {
  const base = DEFAULT_TERMINAL_APPEARANCE
  return {
    fontSize: clamp(
      typeof input?.fontSize === 'number' ? input.fontSize : base.fontSize,
      8,
      32
    ),
    fontFamily:
      typeof input?.fontFamily === 'string' && input.fontFamily.trim()
        ? input.fontFamily.trim()
        : base.fontFamily,
    cursorBlink: typeof input?.cursorBlink === 'boolean' ? input.cursorBlink : base.cursorBlink,
    scrollback: clamp(
      typeof input?.scrollback === 'number' ? input.scrollback : base.scrollback,
      100,
      50000
    ),
    theme: normalizeTerminalTheme(input?.theme, base.theme),
    shellPrompt: input?.shellPrompt === 'server' ? 'server' : base.shellPrompt
  }
}

export function normalizeChromeAppearance(
  input: Partial<ChromeAppearance> | undefined
): ChromeAppearance {
  const base = DEFAULT_CHROME_APPEARANCE
  return {
    sidebarWidth: clamp(
      typeof input?.sidebarWidth === 'number' ? input.sidebarWidth : base.sidebarWidth,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    )
  }
}

export function normalizeUxProfileSettings(
  input: Partial<UxProfileSettings> | undefined
): UxProfileSettings {
  return {
    terminal: normalizeTerminalAppearance(input?.terminal),
    chrome: normalizeChromeAppearance(input?.chrome)
  }
}

export function normalizeUxProfileInput(input: UxProfileInput): UxProfileInput {
  const settings = normalizeUxProfileSettings(input)
  return {
    name: input.name.trim() || 'Untitled',
    ...settings
  }
}
