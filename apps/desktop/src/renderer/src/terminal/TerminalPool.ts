import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebglAddon } from '@xterm/addon-webgl'
import type { TerminalAppearance } from '@consoleri/core'
import { DEFAULT_TERMINAL_APPEARANCE } from '@consoleri/core'
import '@xterm/xterm/css/xterm.css'

export interface PooledTerminal {
  sessionId: string
  term: Terminal
  fitAddon: FitAddon
  serializeAddon: SerializeAddon
  hostEl: HTMLDivElement
  mounted: boolean
  appearance: TerminalAppearance
}

const pool = new Map<string, PooledTerminal>()

export function applyTerminalOptions(term: Terminal, appearance: TerminalAppearance): void {
  term.options.theme = { ...appearance.theme }
  term.options.fontSize = appearance.fontSize
  term.options.fontFamily = appearance.fontFamily
  term.options.cursorBlink = appearance.cursorBlink
}

export function applyToAllTerminals(appearance: TerminalAppearance): void {
  for (const entry of pool.values()) {
    entry.appearance = appearance
    applyTerminalOptions(entry.term, appearance)
    if (entry.mounted) {
      entry.fitAddon.fit()
    }
  }
}

function createTerminal(
  appearance: TerminalAppearance
): { term: Terminal; fitAddon: FitAddon; serializeAddon: SerializeAddon } {
  const term = new Terminal({
    cursorBlink: appearance.cursorBlink,
    fontSize: appearance.fontSize,
    fontFamily: appearance.fontFamily,
    theme: appearance.theme,
    scrollback: appearance.scrollback,
    allowProposedApi: true
  })
  const fitAddon = new FitAddon()
  const serializeAddon = new SerializeAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(serializeAddon)
  try {
    term.loadAddon(new WebglAddon())
  } catch {
    /* WebGL unavailable */
  }
  return { term, fitAddon, serializeAddon }
}

export function acquireTerminal(
  sessionId: string,
  appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
): PooledTerminal {
  let entry = pool.get(sessionId)
  if (!entry) {
    const hostEl = document.createElement('div')
    hostEl.className = 'h-full w-full'
    const { term, fitAddon, serializeAddon } = createTerminal(appearance)
    term.open(hostEl)
    entry = { sessionId, term, fitAddon, serializeAddon, hostEl, mounted: false, appearance }
    pool.set(sessionId, entry)
  } else {
    entry.appearance = appearance
    applyTerminalOptions(entry.term, appearance)
  }
  return entry
}

export function mountTerminal(
  sessionId: string,
  container: HTMLElement,
  appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
): PooledTerminal {
  const entry = acquireTerminal(sessionId, appearance)
  if (entry.hostEl.parentElement !== container) {
    container.appendChild(entry.hostEl)
  }
  entry.mounted = true
  requestAnimationFrame(() => {
    entry.fitAddon.fit()
    const { cols, rows } = entry.term
    window.consoleri.sessions.resize(sessionId, cols, rows)
  })
  return entry
}

export function unmountTerminal(sessionId: string): void {
  const entry = pool.get(sessionId)
  if (entry?.hostEl.parentElement) {
    entry.hostEl.parentElement.removeChild(entry.hostEl)
  }
  if (entry) entry.mounted = false
}

export function releaseTerminal(sessionId: string): void {
  const entry = pool.get(sessionId)
  if (entry) {
    entry.term.dispose()
    pool.delete(sessionId)
  }
}

export function getTerminal(sessionId: string): PooledTerminal | undefined {
  return pool.get(sessionId)
}

export function serializeAll(): Array<{ sessionId: string; data: string }> {
  const result: Array<{ sessionId: string; data: string }> = []
  for (const [sessionId, entry] of pool) {
    result.push({ sessionId, data: entry.serializeAddon.serialize() })
  }
  return result
}
