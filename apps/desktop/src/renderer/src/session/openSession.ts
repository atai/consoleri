import type { MosaicNode } from 'react-mosaic-component'
import { nanoid } from 'nanoid'
import { insertPaneIntoLayout, splitPaneInLayout } from '@consoleri/core'
import type { MosaicNode as CoreMosaicNode } from '@consoleri/core'
import type { OpenSessionRequest, PaneBinding, SessionInfo } from '@shared/types'
import { useSessionWorkspaceStore } from '../stores/sessionWorkspaceStore'
import { usePreferencesStore } from '../stores/preferencesStore'
import { getConsoleriApi } from '../api'
import { releaseTerminal } from '../terminal/TerminalPool'

export async function openSession(request: OpenSessionRequest): Promise<SessionInfo | null> {
  const api = getConsoleriApi()
  const { addSession } = useSessionWorkspaceStore.getState()
  const { settings } = usePreferencesStore.getState()
  const session = await api.sessions.open(request)

  if (session.status === 'error') {
    alert(session.error ?? 'Connection failed')
    if (settings.autoOpenConnectionLog) {
      void api.sessions.openLogWindow(session.id)
    }
    return null
  }

  addSession(session)

  if (settings.autoOpenConnectionLog && session.status === 'connecting') {
    void api.sessions.openLogWindow(session.id)
  }

  return session
}

function createBinding(session: SessionInfo, connectRequest: OpenSessionRequest): PaneBinding {
  return {
    paneId: nanoid(),
    sessionId: session.id,
    protocol: session.protocol,
    title: session.title,
    connectRequest
  }
}

export async function addSessionToWorkspace(
  session: SessionInfo,
  connectRequest: OpenSessionRequest
): Promise<void> {
  const binding = createBinding(session, connectRequest)
  const { workspace, persistWorkspace } = useSessionWorkspaceStore.getState()
  const panes = [...workspace.panes, binding]
  const currentLayout = workspace.layout as MosaicNode<string> | null
  const nextLayout = insertPaneIntoLayout(
    currentLayout as CoreMosaicNode<string> | null,
    binding.paneId
  ) as MosaicNode<string>
  persistWorkspace(nextLayout, panes)
}

export async function splitPaneInWorkspace(
  sourcePaneId: string,
  direction: 'row' | 'column'
): Promise<void> {
  const { workspace, persistWorkspace } = useSessionWorkspaceStore.getState()
  const sourceBinding = workspace.panes.find((p) => p.paneId === sourcePaneId)
  if (!sourceBinding) return

  const session = await openSession({ ...sourceBinding.connectRequest })
  if (!session) return

  const newBinding = createBinding(session, { ...sourceBinding.connectRequest })
  const layout = workspace.layout as MosaicNode<string> | null
  if (!layout) return

  const nextLayout = splitPaneInLayout(
    layout as CoreMosaicNode<string>,
    sourcePaneId,
    newBinding.paneId,
    direction
  ) as MosaicNode<string> | null
  if (!nextLayout) return

  persistWorkspace(nextLayout, [...workspace.panes, newBinding])
}

export async function connectPane(paneId: string): Promise<void> {
  const { workspace, persistWorkspace, removeSession } = useSessionWorkspaceStore.getState()
  const binding = workspace.panes.find((p) => p.paneId === paneId)
  if (!binding) return

  const session = await openSession({ ...binding.connectRequest })
  if (!session) return

  if (binding.sessionId) {
    getConsoleriApi().sessions.close(binding.sessionId)
    releaseTerminal(binding.sessionId)
    removeSession(binding.sessionId)
  }

  const panes = workspace.panes.map((p) =>
    p.paneId === paneId ? { ...p, sessionId: session.id, title: session.title, protocol: session.protocol } : p
  )
  persistWorkspace(workspace.layout as MosaicNode<string> | null, panes)
}


export async function openSessionAndAddToWorkspace(request: OpenSessionRequest): Promise<void> {
  const session = await openSession(request)
  if (!session) return
  await addSessionToWorkspace(session, request)
}
