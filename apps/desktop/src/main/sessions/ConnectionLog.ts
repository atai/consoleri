import type { LogLevel, LogEntry } from '../../shared/types'

const MAX_ENTRIES = 500

type LogListener = (entry: LogEntry) => void

export class ConnectionLog {
  private buffers = new Map<string, LogEntry[]>()
  private listeners = new Map<string, Set<LogListener>>()

  append(sessionId: string, level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      level,
      message,
      meta,
      timestamp: new Date().toISOString()
    }
    const buf = this.buffers.get(sessionId) ?? []
    buf.push(entry)
    if (buf.length > MAX_ENTRIES) buf.shift()
    this.buffers.set(sessionId, buf)

    for (const listener of this.listeners.get(sessionId) ?? []) {
      listener(entry)
    }
    return entry
  }

  getEntries(sessionId: string): LogEntry[] {
    return [...(this.buffers.get(sessionId) ?? [])]
  }

  clear(sessionId: string): void {
    this.buffers.set(sessionId, [])
  }

  subscribe(sessionId: string, listener: LogListener): () => void {
    const set = this.listeners.get(sessionId) ?? new Set()
    set.add(listener)
    this.listeners.set(sessionId, set)
    return () => {
      set.delete(listener)
      if (set.size === 0) this.listeners.delete(sessionId)
    }
  }

  removeSession(sessionId: string): void {
    this.buffers.delete(sessionId)
    this.listeners.delete(sessionId)
  }
}

export const connectionLog = new ConnectionLog()
