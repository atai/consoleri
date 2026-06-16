import { useEffect, useRef } from 'react'
import {
  mountTerminal,
  unmountTerminal,
  restoreScrollback,
  attachTerminalInput,
  resizeTerminal,
  applyTerminalAppearance
} from '../../terminal/TerminalPool'
import { attachClipboardHandlers } from '../../terminal/clipboard'
import { useUxProfileStore } from '../../stores/uxProfileStore'

interface TerminalPaneProps {
  sessionId: string
  hostId?: string | null
  scrollback?: string | null
  onReconnect?: () => void
  disconnected?: boolean
}

export function TerminalPane({
  sessionId,
  hostId,
  scrollback,
  onReconnect,
  disconnected
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolveTerminalForHost = useUxProfileStore((s) => s.resolveTerminalForHost)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const appearance = resolveTerminalForHost(hostId)
    const entry = mountTerminal(sessionId, container, appearance)

    if (scrollback) {
      restoreScrollback(sessionId, scrollback)
    }

    const inputDisposable = attachTerminalInput(sessionId)

    const resizeObserver = new ResizeObserver(() => {
      resizeTerminal(sessionId)
    })
    resizeObserver.observe(container)

    const clipboardHandlers = attachClipboardHandlers(entry.term, container)

    return () => {
      inputDisposable.dispose()
      resizeObserver.disconnect()
      clipboardHandlers.dispose()
      unmountTerminal(sessionId)
    }
  }, [sessionId, scrollback, hostId, resolveTerminalForHost])

  useEffect(() => {
    return useUxProfileStore.subscribe((state, prev) => {
      if (state.profiles === prev.profiles && state.activeId === prev.activeId) return
      const appearance = state.resolveTerminalForHost(hostId)
      applyTerminalAppearance(sessionId, appearance)
    })
  }, [sessionId, hostId])

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {disconnected && (
        <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm">
          <span className="text-amber-400">Session disconnected</span>
          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
            >
              Reconnect
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} className="min-h-0 flex-1 p-1" />
    </div>
  )
}
