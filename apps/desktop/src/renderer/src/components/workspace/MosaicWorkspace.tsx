import { useCallback, useEffect } from 'react'
import {
  Mosaic,
  MosaicWindow,
  MosaicNode,
  MosaicPath,
  MosaicSplitNode,
  createDefaultToolbarButton
} from 'react-mosaic-component'
import 'react-mosaic-component/react-mosaic-component.css'
import { nanoid } from 'nanoid'
import type { PaneBinding, Protocol, SessionInfo, WorkspaceState } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { TerminalPane } from '../terminal/TerminalPane'
import { RdpPane } from '../rdp/RdpPane'
import { VncPane } from '../vnc/VncPane'
import { releaseTerminal, serializeAll } from '../../terminal/TerminalPool'

function isTerminalProtocol(p: Protocol): boolean {
  return p === 'ssh' || p === 'local_pty' || p === 'wsl'
}

interface SessionPaneProps {
  session: SessionInfo | undefined
  onReconnect: (sessionId: string) => void
}

function SessionPaneContent({ session, onReconnect }: SessionPaneProps): React.JSX.Element {
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Session not found
      </div>
    )
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
        disconnected={session.status === 'disconnected'}
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

export function MosaicWorkspace(): React.JSX.Element {
  const { workspace, sessions, setWorkspace } = useAppStore()

  const layout = workspace.layout as MosaicNode<string> | null

  const getSession = useCallback(
    (paneId: string) => {
      const binding = workspace.panes.find((p) => p.paneId === paneId)
      if (!binding) return undefined
      return sessions.find((s) => s.id === binding.sessionId)
    },
    [workspace.panes, sessions]
  )

  const persistWorkspace = useCallback(
    (nextLayout: MosaicNode<string> | null, panes: PaneBinding[]) => {
      const state: WorkspaceState = { layout: nextLayout, panes }
      setWorkspace(state)
      window.consoleri.workspace.save(state)
    },
    [setWorkspace]
  )

  useEffect(() => {
    window.consoleri.workspace.load().then((ws) => {
      if (ws) setWorkspace(ws)
    })
  }, [setWorkspace])

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
      window.consoleri.workspace.save(workspace)
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
    if (binding) {
      window.consoleri.sessions.close(binding.sessionId)
      releaseTerminal(binding.sessionId)
      useAppStore.getState().removeSession(binding.sessionId)
    }
    const newPanes = workspace.panes.filter((p) => p.paneId !== paneId)
    const newLayout = layout ? removeFromLayout(layout, paneId) : null
    persistWorkspace(newLayout, newPanes)
  }

  const renderTile = (paneId: string, path: MosaicPath): React.JSX.Element => {
    const binding = workspace.panes.find((p) => p.paneId === paneId)
    const session = getSession(paneId)
    const title = binding?.title ?? session?.title ?? paneId

    return (
      <MosaicWindow<string>
        path={path}
        title={title}
        toolbarControls={[
          createDefaultToolbarButton('Close', 'close-button', () => closePane(paneId), '×')
        ]}
        createNode={() => paneId}
      >
        {binding ? (
          <SessionPaneContent session={session} onReconnect={handleReconnect} />
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
      className="consoleri-mosaic h-full"
      value={layout}
      onChange={(next) => persistWorkspace(next, workspace.panes)}
      renderTile={renderTile}
      zeroStateView={
        <div className="flex h-full items-center justify-center text-gray-500">
          Connect to a host to begin
        </div>
      }
    />
  )
}

function removeFromLayout(node: MosaicNode<string>, paneId: string): MosaicNode<string> | null {
  if (typeof node === 'string') {
    return node === paneId ? null : node
  }
  if ('type' in node && node.type === 'split') {
    const split = node as MosaicSplitNode<string>
    const children = split.children
      .map((c) => removeFromLayout(c, paneId))
      .filter((c): c is MosaicNode<string> => c !== null)
    if (children.length === 0) return null
    if (children.length === 1) return children[0]
    return { ...split, children }
  }
  return node
}

export async function addSessionToWorkspace(session: SessionInfo): Promise<void> {
  const paneId = nanoid()
  const binding: PaneBinding = {
    paneId,
    sessionId: session.id,
    protocol: session.protocol,
    title: session.title
  }

  const { workspace, setWorkspace } = useAppStore.getState()
  const panes = [...workspace.panes, binding]
  const currentLayout = workspace.layout as MosaicNode<string> | null

  let nextLayout: MosaicNode<string>
  if (!currentLayout) {
    nextLayout = paneId
  } else if (typeof currentLayout === 'string') {
    nextLayout = { type: 'split', direction: 'row', children: [currentLayout, paneId] }
  } else if (currentLayout.type === 'split') {
    nextLayout = {
      ...currentLayout,
      children: [...currentLayout.children, paneId]
    }
  } else {
    nextLayout = paneId
  }

  const state: WorkspaceState = { layout: nextLayout, panes }
  setWorkspace(state)
  await window.consoleri.workspace.save(state)
}
