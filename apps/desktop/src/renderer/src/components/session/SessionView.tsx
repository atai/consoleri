import { isTerminalProtocol } from '@consoleri/core'
import type { PaneBinding, SessionInfo } from '@shared/types'
import { TerminalPane } from '../terminal/TerminalPane'
import { RdpPane } from '../rdp/RdpPane'
import { VncPane } from '../vnc/VncPane'
import { useAutoReconnect } from './useAutoReconnect'

export interface SessionViewProps {
  session: SessionInfo | undefined
  binding?: PaneBinding
  title?: string
  onReconnect: (sessionId: string) => void
  onConnect: () => void
}

// ── sub-components ─────────────────────────────────────────────────────────────

function DisconnectedPane({
  label,
  onConnect
}: {
  label: string
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-sm text-gray-400">
      <p className="text-gray-300">{label}</p>
      <button
        type="button"
        onClick={onConnect}
        className="rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500"
      >
        Connect
      </button>
    </div>
  )
}

function ErrorPane({
  session,
  ar,
  onConnect
}: {
  session: SessionInfo
  ar: AutoReconnectHook
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-red-400">
      <p className="text-center">{session.error ?? 'Connection failed'}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.consoleri.sessions.openLogWindow(session.id)}
          className="rounded border border-[#30363d] px-3 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          View log
        </button>
        <button
          type="button"
          onClick={onConnect}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
        >
          Connect
        </button>
      </div>

      {/* Auto-reconnect panel */}
      <div className="mt-1 w-full max-w-xs rounded border border-[#30363d] text-xs">
        {/* Collapsible header */}
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
          onClick={() => ar.setPanelOpen(!ar.panelOpen)}
        >
          <span>Auto-reconnect</span>
          <span className="text-gray-600">{ar.panelOpen ? '▲' : '▼'}</span>
        </button>

        {ar.panelOpen && (
          <div className="flex flex-col gap-2 border-t border-[#30363d] px-3 py-2">
            {/* Enable + interval + max attempts */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-300">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={ar.autoEnabled}
                  onChange={(e) => (e.target.checked ? ar.enable() : ar.disable())}
                  className="accent-blue-500"
                />
                Enable
              </label>
              <span className="text-gray-500">every</span>
              <input
                type="number"
                min={1}
                max={3600}
                value={ar.intervalSec}
                onChange={(e) =>
                  ar.setIntervalSec(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-14 rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 text-center"
              />
              <span className="text-gray-500">s, stop after</span>
              <input
                type="number"
                min={0}
                value={ar.maxAttempts}
                onChange={(e) =>
                  ar.setMaxAttempts(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="w-14 rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 text-center"
              />
              <span className="text-gray-500">tries (0=∞)</span>
            </div>

            {/* Sound on success */}
            <label className="flex cursor-pointer items-center gap-1.5 text-gray-300">
              <input
                type="checkbox"
                checked={ar.soundEnabled}
                onChange={(e) => ar.setSoundEnabled(e.target.checked)}
                className="accent-blue-500"
              />
              Sound on success
            </label>
          </div>
        )}

        {/* Countdown status bar — visible when auto-reconnect is active */}
        {ar.autoEnabled && (
          <div className="flex items-center justify-between border-t border-[#30363d] px-3 py-1.5 text-gray-400">
            <span>
              Reconnecting in {ar.countdown} s
              {ar.attemptsDone > 0 && (
                <span className="ml-1.5 text-gray-500">
                  · attempt {ar.attemptsDone}
                  {ar.maxAttempts > 0 ? `/${ar.maxAttempts}` : ''}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={ar.disable}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function SessionView({
  session,
  binding,
  title,
  onReconnect,
  onConnect
}: SessionViewProps): React.JSX.Element {
  // Hook must live at this level so state survives error → connecting → error cycles
  const ar = useAutoReconnect(session, onConnect)
  const disconnectedLabel = binding?.title ?? title ?? 'Not connected'

  if (!session) {
    return <DisconnectedPane label={disconnectedLabel} onConnect={onConnect} />
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
        <span className="animate-pulse">
          {ar.autoEnabled ? `Auto-reconnect attempt ${ar.attemptsDone}…` : 'Connecting…'}
        </span>
        <button
          type="button"
          onClick={() => window.consoleri.sessions.openLogWindow(session.id)}
          className="rounded border border-[#30363d] px-3 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          View log
        </button>
      </div>
    )
  }

  if (session.status === 'error') {
    return <ErrorPane session={session} ar={ar} onConnect={onConnect} />
  }

  if (session.status === 'disconnected') {
    return <DisconnectedPane label={disconnectedLabel} onConnect={onConnect} />
  }

  if (session.protocol === 'rdp') {
    return <RdpPane session={session} profileId={session.profileId} />
  }
  if (session.protocol === 'vnc') {
    return <VncPane session={session} />
  }
  if (isTerminalProtocol(session.protocol)) {
    return (
      <TerminalPane
        sessionId={session.id}
        hostId={session.hostId}
        disconnected={false}
        onReconnect={() => onReconnect(session.id)}
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Unknown protocol: {session.protocol}
    </div>
  )
}
