import { Terminal } from '@xterm/xterm'
import type { IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import type { TerminalAppearance } from '@consoleri/core'
import { DEFAULT_TERMINAL_APPEARANCE } from '@consoleri/core'
import { attachTerminalRenderer } from './terminalRenderer'
import { applyTerminalOptions, buildTerminalOptions } from './terminalOptions'
import '@xterm/xterm/css/xterm.css'

export { buildTerminalOptions, applyTerminalOptions } from './terminalOptions'

const MAX_UNMOUNTED_BUFFER_CHARS = 1_000_000

export interface PooledTerminal {
  sessionId: string
  term: Terminal
  fitAddon: FitAddon
  serializeAddon: SerializeAddon
  hostEl: HTMLDivElement
  mounted: boolean
  appearance: TerminalAppearance
}

interface WriteBuffer {
  chunks: string[]
  charCount: number
  scheduled: boolean
  rafId: number | null
}

class TerminalService {
  private readonly pool = new Map<string, PooledTerminal>()
  private readonly writeBuffers = new Map<string, WriteBuffer>()
  private readonly inputDisposables = new Map<string, IDisposable>()
  private unsubData: (() => void) | null = null

  private ensureDataDispatcher(): void {
    if (this.unsubData) return
    this.unsubData = window.consoleri.sessions.onData(({ id, data }) => {
      this.enqueueWrite(id, data)
    })
  }

  private getOrCreateBuffer(sessionId: string): WriteBuffer {
    let buffer = this.writeBuffers.get(sessionId)
    if (!buffer) {
      buffer = { chunks: [], charCount: 0, scheduled: false, rafId: null }
      this.writeBuffers.set(sessionId, buffer)
    }
    return buffer
  }

  private trimBuffer(buffer: WriteBuffer): void {
    while (buffer.charCount > MAX_UNMOUNTED_BUFFER_CHARS && buffer.chunks.length > 0) {
      const removed = buffer.chunks.shift()!
      buffer.charCount -= removed.length
    }
  }

  private scheduleFlush(sessionId: string): void {
    const buffer = this.getOrCreateBuffer(sessionId)
    if (buffer.scheduled) return
    buffer.scheduled = true
    buffer.rafId = requestAnimationFrame(() => {
      this.flushWrite(sessionId)
    })
  }

  private flushWrite(sessionId: string): void {
    const buffer = this.writeBuffers.get(sessionId)
    if (!buffer) return

    buffer.scheduled = false
    buffer.rafId = null

    if (buffer.chunks.length === 0) return

    const data = buffer.chunks.join('')
    buffer.chunks = []
    buffer.charCount = 0

    const entry = this.pool.get(sessionId)
    if (!entry) return

    entry.term.write(data)
  }

  enqueueWrite(sessionId: string, data: string): void {
    if (!data) return

    this.ensureDataDispatcher()

    const entry = this.pool.get(sessionId)
    const buffer = this.getOrCreateBuffer(sessionId)
    buffer.chunks.push(data)
    buffer.charCount += data.length

    if (!entry?.mounted) {
      this.trimBuffer(buffer)
      return
    }

    this.scheduleFlush(sessionId)
  }

  private clearWriteBuffer(sessionId: string): void {
    const buffer = this.writeBuffers.get(sessionId)
    if (!buffer) return
    if (buffer.rafId !== null) {
      cancelAnimationFrame(buffer.rafId)
    }
    this.writeBuffers.delete(sessionId)
  }

  private createTerminal(
    sessionId: string,
    appearance: TerminalAppearance
  ): { term: Terminal; fitAddon: FitAddon; serializeAddon: SerializeAddon } {
    const term = new Terminal(buildTerminalOptions(appearance))
    const fitAddon = new FitAddon()
    const serializeAddon = new SerializeAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(serializeAddon)
    attachTerminalRenderer(term, sessionId)
    return { term, fitAddon, serializeAddon }
  }

  acquireTerminal(
    sessionId: string,
    appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
  ): PooledTerminal {
    this.ensureDataDispatcher()

    let entry = this.pool.get(sessionId)
    if (!entry) {
      const hostEl = document.createElement('div')
      hostEl.className = 'h-full w-full'
      const { term, fitAddon, serializeAddon } = this.createTerminal(sessionId, appearance)
      term.open(hostEl)
      entry = { sessionId, term, fitAddon, serializeAddon, hostEl, mounted: false, appearance }
      this.pool.set(sessionId, entry)
    } else {
      entry.appearance = appearance
      applyTerminalOptions(entry.term, appearance)
    }
    return entry
  }

  mountTerminal(
    sessionId: string,
    container: HTMLElement,
    appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
  ): PooledTerminal {
    const entry = this.acquireTerminal(sessionId, appearance)
    if (entry.hostEl.parentElement !== container) {
      container.appendChild(entry.hostEl)
    }
    entry.mounted = true
    this.flushWrite(sessionId)
    requestAnimationFrame(() => {
      this.resizeTerminal(sessionId)
    })
    return entry
  }

  unmountTerminal(sessionId: string): void {
    const entry = this.pool.get(sessionId)
    if (entry?.hostEl.parentElement) {
      entry.hostEl.parentElement.removeChild(entry.hostEl)
    }
    if (entry) entry.mounted = false
    this.detachInput(sessionId)
  }

  releaseTerminal(sessionId: string): void {
    this.detachInput(sessionId)
    this.clearWriteBuffer(sessionId)
    const entry = this.pool.get(sessionId)
    if (entry) {
      entry.term.dispose()
      this.pool.delete(sessionId)
    }
  }

  getTerminal(sessionId: string): PooledTerminal | undefined {
    return this.pool.get(sessionId)
  }

  attachInput(sessionId: string): IDisposable {
    const existing = this.inputDisposables.get(sessionId)
    if (existing) return existing

    const entry = this.pool.get(sessionId)
    if (!entry) {
      return { dispose: () => {} }
    }

    const disposable = entry.term.onData((data) => {
      void window.consoleri.sessions.write(sessionId, data)
    })
    this.inputDisposables.set(sessionId, disposable)
    return disposable
  }

  detachInput(sessionId: string): void {
    const disposable = this.inputDisposables.get(sessionId)
    if (disposable) {
      disposable.dispose()
      this.inputDisposables.delete(sessionId)
    }
  }

  resizeTerminal(sessionId: string): void {
    const entry = this.pool.get(sessionId)
    if (!entry?.mounted) return
    entry.fitAddon.fit()
    void window.consoleri.sessions.resize(sessionId, entry.term.cols, entry.term.rows)
  }

  applyAppearance(sessionId: string, appearance: TerminalAppearance): void {
    const entry = this.pool.get(sessionId)
    if (!entry) return
    entry.appearance = appearance
    applyTerminalOptions(entry.term, appearance)
    if (entry.mounted) {
      entry.fitAddon.fit()
    }
  }

  applyAppearanceToAll(
    sessions: Array<{ id: string; hostId: string | null | undefined }>,
    resolveTerminalForHost: (hostId: string | null | undefined) => TerminalAppearance
  ): void {
    for (const session of sessions) {
      const entry = this.pool.get(session.id)
      if (!entry) continue
      const appearance = resolveTerminalForHost(session.hostId)
      entry.appearance = appearance
      applyTerminalOptions(entry.term, appearance)
      if (entry.mounted) {
        entry.fitAddon.fit()
      }
    }
  }

  restoreScrollback(sessionId: string, data: string): void {
    const entry = this.acquireTerminal(sessionId)
    this.clearWriteBuffer(sessionId)
    entry.term.reset()
    if (data) {
      entry.term.write(data)
    }
  }

  serializeAll(): Array<{ sessionId: string; data: string }> {
    const result: Array<{ sessionId: string; data: string }> = []
    for (const [sessionId, entry] of this.pool) {
      result.push({ sessionId, data: entry.serializeAddon.serialize() })
    }
    return result
  }
}

export const terminalService = new TerminalService()
