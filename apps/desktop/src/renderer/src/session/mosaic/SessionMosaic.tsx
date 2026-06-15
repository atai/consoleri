import { useCallback, type ReactElement, type ReactNode } from 'react'
import {
  Mosaic,
  MosaicWindow,
  MosaicNode,
  MosaicPath
} from 'react-mosaic-component'
import { removeFromLayout } from '@consoleri/core'
import type { MosaicNode as CoreMosaicNode } from '@consoleri/core'
import type { PaneBinding, SessionInfo } from '@shared/types'
import { SessionView } from '../../components/session/SessionView'
import { releaseTerminal } from '../../terminal/TerminalPool'
import {
  closeToolbarButton,
  connectToolbarButton,
  logToolbarButton,
  splitSideBySideButton,
  splitStackedButton
} from '../../components/workspace/MosaicToolbarButton'

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

export interface SessionMosaicProps {
  layout: MosaicNode<string> | null
  panes: PaneBinding[]
  sessions: SessionInfo[]
  onLayoutChange: (layout: MosaicNode<string> | null, options?: { debounce?: boolean }) => void
  onPanesChange: (panes: PaneBinding[]) => void
  onSessionUpdated: (session: SessionInfo) => void
  onSessionRemoved: (sessionId: string) => void
  onSplitPane: (paneId: string, direction: 'row' | 'column') => void | Promise<void>
  onConnectPane: (paneId: string) => void | Promise<void>
  onClosePane: (paneId: string) => void
  zeroStateView?: ReactElement
  emptyLayoutView?: ReactNode
}

export function SessionMosaic({
  layout,
  panes,
  sessions,
  onLayoutChange,
  onSessionUpdated,
  onSplitPane,
  onConnectPane,
  onClosePane,
  zeroStateView,
  emptyLayoutView
}: SessionMosaicProps): React.JSX.Element {
  const getSession = useCallback(
    (paneId: string) => {
      const binding = panes.find((p) => p.paneId === paneId)
      if (!binding?.sessionId) return undefined
      return sessions.find((s) => s.id === binding.sessionId)
    },
    [panes, sessions]
  )

  const handleReconnect = async (sessionId: string): Promise<void> => {
    const updated = await window.consoleri.sessions.reconnect(sessionId)
    if (updated) onSessionUpdated(updated)
  }

  const openLog = (sessionId: string): void => {
    void window.consoleri.sessions.openLogWindow(sessionId)
  }

  const renderTile = (paneId: string, path: MosaicPath): React.JSX.Element => {
    const binding = panes.find((p) => p.paneId === paneId)
    const session = getSession(paneId)
    const title = paneTitle(session, binding, paneId)
    const showLog = session?.status === 'connecting' || session?.status === 'error'
    const splitDisabled = session?.status === 'connecting'
    const showConnect = needsConnect(session, binding)

    const toolbarControls = [
      ...(!splitDisabled
        ? [
            splitSideBySideButton(() => void onSplitPane(paneId, 'row')),
            splitStackedButton(() => void onSplitPane(paneId, 'column'))
          ]
        : []),
      ...(showConnect ? [connectToolbarButton(() => void onConnectPane(paneId))] : []),
      ...(showLog && binding?.sessionId
        ? [logToolbarButton(() => openLog(binding.sessionId!))]
        : []),
      closeToolbarButton(() => onClosePane(paneId))
    ]

    return (
      <MosaicWindow<string> path={path} title={title} toolbarControls={toolbarControls}>
        {binding ? (
          <SessionView
            session={session}
            binding={binding}
            onReconnect={handleReconnect}
            onConnect={() => void onConnectPane(paneId)}
          />
        ) : (
          <div className="p-4 text-sm text-gray-500">Empty pane</div>
        )}
      </MosaicWindow>
    )
  }

  if (!layout) {
    return (
      <>
        {emptyLayoutView ?? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
            <p className="text-lg">No active sessions</p>
            <p className="text-sm">Select a host from the sidebar or open a local shell</p>
          </div>
        )}
      </>
    )
  }

  return (
    <Mosaic<string>
      className="consoleri-mosaic mosaic-blueprint-theme bp5-dark h-full"
      value={layout}
      onChange={(next) => onLayoutChange(next, { debounce: true })}
      renderTile={renderTile}
      zeroStateView={
        zeroStateView ?? (
          <div className="flex h-full items-center justify-center text-gray-500">
            Connect to a host to begin
          </div>
        )
      }
    />
  )
}

export function closeMosaicPane(
  layout: MosaicNode<string> | null,
  panes: PaneBinding[],
  paneId: string
): { layout: MosaicNode<string> | null; panes: PaneBinding[]; closedSessionId: string | null } {
  const binding = panes.find((p) => p.paneId === paneId)
  const closedSessionId = binding?.sessionId ?? null

  if (binding?.sessionId) {
    window.consoleri.sessions.close(binding.sessionId)
    releaseTerminal(binding.sessionId)
  }

  const newPanes = panes.filter((p) => p.paneId !== paneId)
  const newLayout = layout
    ? (removeFromLayout(layout as CoreMosaicNode<string>, paneId) as MosaicNode<string> | null)
    : null

  return { layout: newLayout, panes: newPanes, closedSessionId }
}
