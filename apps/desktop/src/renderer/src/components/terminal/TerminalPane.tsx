import { useEffect, useRef } from 'react'
import { mountTerminal, unmountTerminal, acquireTerminal } from '../../terminal/TerminalPool'

interface TerminalPaneProps {
  sessionId: string
  scrollback?: string | null
  onReconnect?: () => void
  disconnected?: boolean
}

export function TerminalPane({
  sessionId,
  scrollback,
  onReconnect,
  disconnected
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const entry = mountTerminal(sessionId, container)

    if (scrollback) {
      entry.term.reset()
      entry.term.write(scrollback)
    }

    const dataDisposable = entry.term.onData((data) => {
      window.consoleri.sessions.write(sessionId, data)
    })

    const unsubData = window.consoleri.sessions.onData(({ id, data }) => {
      if (id === sessionId) entry.term.write(data)
    })

    const resizeObserver = new ResizeObserver(() => {
      entry.fitAddon.fit()
      window.consoleri.sessions.resize(sessionId, entry.term.cols, entry.term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      dataDisposable.dispose()
      unsubData()
      resizeObserver.disconnect()
      unmountTerminal(sessionId)
    }
  }, [sessionId, scrollback])

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

export function restoreScrollback(sessionId: string, data: string): void {
  const entry = acquireTerminal(sessionId)
  entry.term.reset()
  entry.term.write(data)
}
