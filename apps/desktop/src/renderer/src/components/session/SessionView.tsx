import { isTerminalProtocol } from '@consoleri/core'
import type { PaneBinding, SessionInfo } from '@shared/types'
import { TerminalPane } from '../terminal/TerminalPane'
import { RdpPane } from '../rdp/RdpPane'
import { VncPane } from '../vnc/VncPane'

export interface SessionViewProps {
  session: SessionInfo | undefined
  binding?: PaneBinding
  title?: string
  onReconnect: (sessionId: string) => void
  onConnect: () => void
}

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

export function SessionView({
  session,
  binding,
  title,
  onReconnect,
  onConnect
}: SessionViewProps): React.JSX.Element {
  const disconnectedLabel = binding?.title ?? title ?? 'Not connected'

  if (!session) {
    return <DisconnectedPane label={disconnectedLabel} onConnect={onConnect} />
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
        <span className="animate-pulse">Connecting…</span>
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-red-400">
        <p>{session.error ?? 'Connection failed'}</p>
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
    )
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
