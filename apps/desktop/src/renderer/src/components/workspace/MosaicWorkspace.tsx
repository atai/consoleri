import { useCallback, useEffect } from 'react'
import {
  Mosaic,
  MosaicWindow,
  MosaicNode,
  MosaicPath
} from 'react-mosaic-component'
import { removeFromLayout, isTerminalProtocol } from '@consoleri/core'
import type { MosaicNode as CoreMosaicNode } from '@consoleri/core'
import type { PaneBinding, SessionInfo } from '@shared/types'
import { useAppStore, flushWorkspacePersist } from '../../stores/appStore'
import { TerminalPane } from '../terminal/TerminalPane'
import { RdpPane } from '../rdp/RdpPane'
import { VncPane } from '../vnc/VncPane'
import { releaseTerminal, serializeAll } from '../../terminal/TerminalPool'
import { connectPane, splitPaneInWorkspace } from '../../session/openSession'
import {
  closeToolbarButton,
  connectToolbarButton,
  logToolbarButton,
  splitSideBySideButton,
  splitStackedButton
} from './MosaicToolbarButton'

interface SessionPaneProps {
  session: SessionInfo | undefined
  binding: PaneBinding | undefined
  onReconnect: (sessionId: string) => void
  onConnect: () => void
}

function DisconnectedPane({
  binding,
  onConnect
}: {
  binding: PaneBinding | undefined
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-sm text-gray-400">
      <p className="text-gray-300">{binding?.title ?? 'Not connected'}</p>
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

function SessionPaneContent({ session, binding, onReconnect, onConnect }: SessionPaneProps): React.JSX.Element {
  if (!session) {
    return <DisconnectedPane binding={binding} onConnect={onConnect} />
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
    return <DisconnectedPane binding={binding} onConnect={onConnect} />
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

function paneTitle(session: SessionInfo | undefined, binding: PaneBinding | undefined, paneId: string): string {
  const base = binding?.title ?? session?.title ?? paneId
  if (!session) return base
  if (session.status === 'connecting') return `${base} — Connecting…`
  if (session.status === 'error') return `${base} — Error`
  return base
}

function needsConnect(session: SessionInfo | undefined, binding: PaneBinding | undefined): boolean {
  if (!binding?.connectRequest) return false
  if (!binding.sessionId || !session) return true
  return session.status === 'error' || session.status === 'disconnected'
}

export function MosaicWorkspace(): React.JSX.Element {
  const { workspace, sessions, persistWorkspace } = useAppStore()

  const layout = workspace.layout as MosaicNode<string> | null

  const getSession = useCallback(
    (paneId: string) => {
      const binding = workspace.panes.find((p) => p.paneId === paneId)
      if (!binding?.sessionId) return undefined
      return sessions.find((s) => s.id === binding.sessionId)
    },
    [workspace.panes, sessions]
  )

  useEffect(() => {
    const saveOnExit = (): void => {
      const scrollbacks = serializeAll()
      for (const { sessionId, data } of scrollbacks) {
        const session = sessions.find((s) => s.id === sessionId)
        if (!session) continue
        window.consoleri.sessions.snapshot({
          id: sessionId,
          hostId: session.hostId,
          profileId: session.profileId,
          protocol: session.protocol,
          title: session.title,
          cwd: null,
          cols: 80,
          rows: 24,
          scrollbackSerialized: data
        })
      }
      flushWorkspacePersist()
    }
    window.addEventListener('beforeunload', saveOnExit)
    return () => window.removeEventListener('beforeunload', saveOnExit)
  }, [workspace, sessions])

  const handleReconnect = async (sessionId: string): Promise<void> => {
    const updated = await window.consoleri.sessions.reconnect(sessionId)
    if (updated) {
      useAppStore.getState().updateSession(sessionId, updated)
    }
  }

  const closePane = (paneId: string): void => {
    const binding = workspace.panes.find((p) => p.paneId === paneId)
    if (binding?.sessionId) {
      window.consoleri.sessions.close(binding.sessionId)
      releaseTerminal(binding.sessionId)
      useAppStore.getState().removeSession(binding.sessionId)
    }
    const newPanes = workspace.panes.filter((p) => p.paneId !== paneId)
    const newLayout = layout
      ? (removeFromLayout(layout as CoreMosaicNode<string>, paneId) as MosaicNode<string> | null)
      : null
    persistWorkspace(newLayout, newPanes)
  }

  const openLog = (sessionId: string): void => {
    void window.consoleri.sessions.openLogWindow(sessionId)
  }

  const renderTile = (paneId: string, path: MosaicPath): React.JSX.Element => {
    const binding = workspace.panes.find((p) => p.paneId === paneId)
    const session = getSession(paneId)
    const title = paneTitle(session, binding, paneId)
    const showLog = session?.status === 'connecting' || session?.status === 'error'
    const splitDisabled = session?.status === 'connecting'
    const showConnect = needsConnect(session, binding)

    const toolbarControls = [
      ...(!splitDisabled
        ? [
            splitSideBySideButton(() => void splitPaneInWorkspace(paneId, 'row')),
            splitStackedButton(() => void splitPaneInWorkspace(paneId, 'column'))
          ]
        : []),
      ...(showConnect ? [connectToolbarButton(() => void connectPane(paneId))] : []),
      ...(showLog && binding?.sessionId
        ? [logToolbarButton(() => openLog(binding.sessionId!))]
        : []),
      closeToolbarButton(() => closePane(paneId))
    ]

    return (
      <MosaicWindow<string> path={path} title={title} toolbarControls={toolbarControls}>
        {binding ? (
          <SessionPaneContent
            session={session}
            binding={binding}
            onReconnect={handleReconnect}
            onConnect={() => void connectPane(paneId)}
          />
        ) : (
          <div className="p-4 text-sm text-gray-500">Empty pane</div>
        )}
      </MosaicWindow>
    )
  }

  if (!layout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
        <p className="text-lg">No active sessions</p>
        <p className="text-sm">Select a host from the sidebar or open a local shell</p>
      </div>
    )
  }

  return (
    <Mosaic<string>
      className="consoleri-mosaic mosaic-blueprint-theme bp5-dark h-full"
      value={layout}
      onChange={(next) => persistWorkspace(next, workspace.panes, { debounce: true })}
      renderTile={renderTile}
      zeroStateView={
        <div className="flex h-full items-center justify-center text-gray-500">
          Connect to a host to begin
        </div>
      }
    />
  )
}

// Re-export for backward compatibility during transition
export { addSessionToWorkspace, openSessionAndAddToWorkspace } from '../../session/openSession'

// layoutSaveTimer is owned by appStore; referenced here for flush on beforeunload
declare const layoutSaveTimer: ReturnType<typeof setTimeout> | null
