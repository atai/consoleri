import { useCallback, useEffect } from 'react'
import type { MosaicNode } from 'react-mosaic-component'
import type { SessionInfo } from '@shared/types'
import { useAppStore, flushWorkspacePersist } from '../../stores/appStore'
import { SessionMosaic, closeMosaicPane } from '../../session/mosaic/SessionMosaic'
import { reconnectMosaicPane, splitMosaicPane } from '../../session/mosaic/sessionMosaicOps'
import { serializeAll } from '../../terminal/TerminalPool'

export function MosaicWorkspace(): React.JSX.Element {
  const { workspace, sessions, persistWorkspace, addSession, updateSession, removeSession } =
    useAppStore()

  const layout = workspace.layout as MosaicNode<string> | null

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

  const handleLayoutChange = useCallback(
    (next: MosaicNode<string> | null, options?: { debounce?: boolean }) => {
      persistWorkspace(next, workspace.panes, options)
    },
    [persistWorkspace, workspace.panes]
  )

  const handleSplitPane = async (paneId: string, direction: 'row' | 'column'): Promise<void> => {
    const result = await splitMosaicPane(layout, workspace.panes, paneId, direction)
    if (!result) return
    result.sessions.forEach((session) => addSession(session))
    persistWorkspace(result.layout, result.panes)
  }

  const handleConnectPane = async (paneId: string): Promise<void> => {
    const result = await reconnectMosaicPane(workspace.panes, paneId)
    if (!result) return
    updateSession(result.session.id, result.session)
    persistWorkspace(layout, result.panes)
  }

  const handleClosePane = (paneId: string): void => {
    const { layout: nextLayout, panes: nextPanes, closedSessionId } = closeMosaicPane(
      layout,
      workspace.panes,
      paneId
    )
    if (closedSessionId) {
      removeSession(closedSessionId)
    }
    persistWorkspace(nextLayout, nextPanes)
  }

  const handleSessionUpdated = (session: SessionInfo): void => {
    updateSession(session.id, session)
  }

  return (
    <SessionMosaic
      layout={layout}
      panes={workspace.panes}
      sessions={sessions}
      onLayoutChange={handleLayoutChange}
      onPanesChange={(panes) => persistWorkspace(layout, panes)}
      onSessionUpdated={handleSessionUpdated}
      onSessionRemoved={removeSession}
      onSplitPane={handleSplitPane}
      onConnectPane={handleConnectPane}
      onClosePane={handleClosePane}
    />
  )
}

export { addSessionToWorkspace, openSessionAndAddToWorkspace } from '../../session/openSession'

declare const layoutSaveTimer: ReturnType<typeof setTimeout> | null
