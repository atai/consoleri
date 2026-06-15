import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

export interface PooledTerminal {
  sessionId: string
  term: Terminal
  fitAddon: FitAddon
  serializeAddon: SerializeAddon
  hostEl: HTMLDivElement
  mounted: boolean
}

const pool = new Map<string, PooledTerminal>()

const TERM_THEME = {
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

export function acquireTerminal(sessionId: string): PooledTerminal {
  let entry = pool.get(sessionId)
  if (!entry) {
    const hostEl = document.createElement('div')
    hostEl.className = 'h-full w-full'
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      theme: TERM_THEME,
      scrollback: 10000,
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
    term.open(hostEl)
    entry = { sessionId, term, fitAddon, serializeAddon, hostEl, mounted: false }
    pool.set(sessionId, entry)
  }
  return entry
}

export function mountTerminal(sessionId: string, container: HTMLElement): PooledTerminal {
  const entry = acquireTerminal(sessionId)
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
