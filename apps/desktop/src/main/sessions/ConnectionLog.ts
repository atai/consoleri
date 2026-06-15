import {
  maxLogEntriesForVerbosity,
  shouldIncludeLogEntry,
  type HostLogVerbosity
} from '@consoleri/core'
import type { LogLevel, LogEntry } from '../../shared/types'

type LogListener = (entry: LogEntry) => void

export class ConnectionLog {
  private buffers = new Map<string, LogEntry[]>()
  private listeners = new Map<string, Set<LogListener>>()
  private verbosity = new Map<string, HostLogVerbosity>()
  private entryLimits = new Map<string, number>()

  setSessionVerbosity(sessionId: string, verbosity: HostLogVerbosity): void {
    this.verbosity.set(sessionId, verbosity)
    this.entryLimits.set(sessionId, maxLogEntriesForVerbosity(verbosity))
  }

  append(
    sessionId: string,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): LogEntry | null {
    const verbosity = this.verbosity.get(sessionId) ?? 'info'
    if (!shouldIncludeLogEntry(verbosity, level, meta)) {
      return null
    }

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
    const maxEntries = this.entryLimits.get(sessionId) ?? 500
    while (buf.length > maxEntries) buf.shift()
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
    this.verbosity.delete(sessionId)
    this.entryLimits.delete(sessionId)
  }
}

export const connectionLog = new ConnectionLog()
