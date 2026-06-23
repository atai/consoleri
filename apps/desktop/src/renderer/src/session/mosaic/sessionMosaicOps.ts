import { nanoid } from 'nanoid'
import type { MosaicNode } from 'react-mosaic-component'
import { insertPaneIntoLayout, splitPaneInLayout } from '@consoleri/core'
import type { MosaicNode as CoreMosaicNode } from '@consoleri/core'
import type { OpenSessionRequest, PaneBinding, SessionInfo } from '@shared/types'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { getConsoleriApi } from '../../api'

export function createPaneBinding(
  session: SessionInfo,
  connectRequest: OpenSessionRequest
): PaneBinding {
  return {
    paneId: nanoid(),
    sessionId: session.id,
    protocol: session.protocol,
    title: session.title,
    connectRequest: { ...connectRequest }
  }
}

export async function openMosaicSession(
  request: OpenSessionRequest
): Promise<SessionInfo | null> {
  const api = getConsoleriApi()
  const session = await api.sessions.open(request)

  const autoOpenConnectionLog = usePreferencesStore.getState().settings.autoOpenConnectionLog

  if (session.status === 'error') {
    alert(session.error ?? 'Connection failed')
    if (autoOpenConnectionLog) {
      void api.sessions.openLogWindow(session.id)
    }
    return null
  }

  if (autoOpenConnectionLog && session.status === 'connecting') {
    void api.sessions.openLogWindow(session.id)
  }

  return session
}

export function insertPane(
  layout: MosaicNode<string> | null,
  panes: PaneBinding[],
  binding: PaneBinding
): { layout: MosaicNode<string> | null; panes: PaneBinding[] } {
  const nextLayout = insertPaneIntoLayout(
    layout as CoreMosaicNode<string> | null,
    binding.paneId
  ) as MosaicNode<string>
  return { layout: nextLayout, panes: [...panes, binding] }
}

export async function splitMosaicPane(
  layout: MosaicNode<string> | null,
  panes: PaneBinding[],
  sourcePaneId: string,
  direction: 'row' | 'column'
): Promise<{ layout: MosaicNode<string> | null; panes: PaneBinding[]; sessions: SessionInfo[] } | null> {
  const sourceBinding = panes.find((p) => p.paneId === sourcePaneId)
  if (!sourceBinding || !layout) return null

  const session = await openMosaicSession({ ...sourceBinding.connectRequest })
  if (!session) return null

  const newBinding = createPaneBinding(session, { ...sourceBinding.connectRequest })
  const nextLayout = splitPaneInLayout(
    layout as CoreMosaicNode<string>,
    sourcePaneId,
    newBinding.paneId,
    direction
  ) as MosaicNode<string> | null
  if (!nextLayout) return null

  return {
    layout: nextLayout,
    panes: [...panes, newBinding],
    sessions: [session]
  }
}

export async function reconnectMosaicPane(
  panes: PaneBinding[],
  paneId: string
): Promise<{ panes: PaneBinding[]; session: SessionInfo } | null> {
  const binding = panes.find((p) => p.paneId === paneId)
  if (!binding) return null

  const session = binding.sessionId
    ? await getConsoleriApi().sessions.reconnect(binding.sessionId)
    : await openMosaicSession({ ...binding.connectRequest })

  if (!session) return null

  const nextPanes = panes.map((p) =>
    p.paneId === paneId
      ? { ...p, sessionId: session.id, title: session.title, protocol: session.protocol }
      : p
  )

  return { panes: nextPanes, session }
}
