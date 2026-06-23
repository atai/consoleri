import type { BrowserWindow } from 'electron'

const registry = new Map<string, BrowserWindow>()

export function registerSessionWindow(sessionId: string, win: BrowserWindow): void {
  registry.set(sessionId, win)
}

export function unregisterSessionWindow(sessionId: string): void {
  registry.delete(sessionId)
}

export function getRegisteredSessionWindow(sessionId: string): BrowserWindow | undefined {
  const win = registry.get(sessionId)
  if (win && !win.isDestroyed()) return win
  return undefined
}
