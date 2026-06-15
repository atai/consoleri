import { nanoid } from 'nanoid'
import type { MosaicNode } from 'react-mosaic-component'
import { insertPaneIntoLayout, splitPaneInLayout } from '@consoleri/core'
import type { MosaicNode as CoreMosaicNode } from '@consoleri/core'
import type { OpenSessionRequest, PaneBinding, SessionInfo } from '@shared/types'

const SETTINGS_KEY = 'consoleri.settings'

function loadAutoOpenConnectionLog(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { autoOpenConnectionLog?: boolean }
      return parsed.autoOpenConnectionLog ?? false
    }
  } catch {
    /* ignore */
  }
  return false
}

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
  const session = await window.consoleri.sessions.open(request)

  if (session.status === 'error') {
    alert(session.error ?? 'Connection failed')
    if (loadAutoOpenConnectionLog()) {
      void window.consoleri.sessions.openLogWindow(session.id)
    }
    return null
  }

  if (loadAutoOpenConnectionLog() && session.status === 'connecting') {
    void window.consoleri.sessions.openLogWindow(session.id)
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
    ? await window.consoleri.sessions.reconnect(binding.sessionId)
    : await openMosaicSession({ ...binding.connectRequest })

  if (!session) return null

  const nextPanes = panes.map((p) =>
    p.paneId === paneId
      ? { ...p, sessionId: session.id, title: session.title, protocol: session.protocol }
      : p
  )

  return { panes: nextPanes, session }
}
