import type { IDisposable } from '@xterm/xterm'
import type { TerminalAppearance } from '@consoleri/core'
import { DEFAULT_TERMINAL_APPEARANCE } from '@consoleri/core'
import { terminalService, type PooledTerminal } from './TerminalService'

export type { PooledTerminal } from './TerminalService'
export { buildTerminalOptions, applyTerminalOptions } from './terminalOptions'

export function acquireTerminal(
  sessionId: string,
  appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
): PooledTerminal {
  return terminalService.acquireTerminal(sessionId, appearance)
}

export function mountTerminal(
  sessionId: string,
  container: HTMLElement,
  appearance: TerminalAppearance = DEFAULT_TERMINAL_APPEARANCE
): PooledTerminal {
  return terminalService.mountTerminal(sessionId, container, appearance)
}

export function unmountTerminal(sessionId: string): void {
  terminalService.unmountTerminal(sessionId)
}

export function releaseTerminal(sessionId: string): void {
  terminalService.releaseTerminal(sessionId)
}

export function getTerminal(sessionId: string): PooledTerminal | undefined {
  return terminalService.getTerminal(sessionId)
}

export function restoreScrollback(sessionId: string, data: string): void {
  terminalService.restoreScrollback(sessionId, data)
}

export function serializeAll(): Array<{ sessionId: string; data: string }> {
  return terminalService.serializeAll()
}

export function applyAppearanceToAll(
  sessions: Array<{ id: string; hostId: string | null | undefined }>,
  resolveTerminalForHost: (hostId: string | null | undefined) => TerminalAppearance
): void {
  terminalService.applyAppearanceToAll(sessions, resolveTerminalForHost)
}

export function attachTerminalInput(sessionId: string): IDisposable {
  return terminalService.attachInput(sessionId)
}

export function resizeTerminal(sessionId: string): void {
  terminalService.resizeTerminal(sessionId)
}

export function applyTerminalAppearance(
  sessionId: string,
  appearance: TerminalAppearance
): void {
  terminalService.applyAppearance(sessionId, appearance)
}
