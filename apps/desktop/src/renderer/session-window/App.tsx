import { useCallback, useEffect, useState } from 'react'
import type { MosaicNode } from 'react-mosaic-component'
import { nanoid } from 'nanoid'
import type { OpenSessionRequest, PaneBinding, SessionInfo } from '@shared/types'
import { SessionMosaic, closeMosaicPane } from '../src/session/mosaic/SessionMosaic'
import { reconnectMosaicPane, splitMosaicPane } from '../src/session/mosaic/sessionMosaicOps'
import { useUxProfileStore } from '../src/stores/uxProfileStore'
import { releaseTerminal } from '../src/terminal/TerminalPool'

function getSessionIdFromUrl(): string {
  return new URLSearchParams(window.location.search).get('sessionId') ?? ''
}

export function SessionWindowApp(): React.JSX.Element {
  const sessionId = getSessionIdFromUrl()
  const refreshUxProfiles = useUxProfileStore((s) => s.refresh)
  const [layout, setLayout] = useState<MosaicNode<string> | null>(null)
  const [panes, setPanes] = useState<PaneBinding[]>([])
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [initError, setInitError] = useState<string | null>(null)

  const upsertSession = useCallback((session: SessionInfo): void => {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === session.id)
      if (index === -1) return [...prev, session]
      return prev.map((s) => (s.id === session.id ? session : s))
    })
  }, [])

  useEffect(() => {
    void refreshUxProfiles()
  }, [refreshUxProfiles])

  useEffect(() => {
    if (!sessionId) return

    const init = async (): Promise<void> => {
      const listed = await window.consoleri.sessions.list()
      const session = listed.find((s) => s.id === sessionId)
      if (!session) {
        setInitError('Session not found')
        return
      }

      const connectRequest =
        (await window.consoleri.sessions.getConnectRequest(sessionId)) ??
        ({
          hostId: session.hostId ?? undefined,
          profileId: session.profileId ?? undefined,
          protocol: session.protocol,
          title: session.title
        } satisfies OpenSessionRequest)

      const paneId = nanoid()
      const binding: PaneBinding = {
        paneId,
        sessionId: session.id,
        protocol: session.protocol,
        title: session.title,
        connectRequest
      }

      setPanes([binding])
      setLayout(paneId)
      setSessions([session])
    }

    void init()
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return

    const unsubStatus = window.consoleri.sessions.onStatus(({ id, status, error }) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: status as SessionInfo['status'], error } : s
        )
      )
    })

    const unsubExit = window.consoleri.sessions.onExit(({ id }) => {
      releaseTerminal(id)
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s))
      )
    })

    return () => {
      unsubStatus()
      unsubExit()
    }
  }, [sessionId])

  const handleSplitPane = async (paneId: string, direction: 'row' | 'column'): Promise<void> => {
    const result = await splitMosaicPane(layout, panes, paneId, direction)
    if (!result) return
    setLayout(result.layout)
    setPanes(result.panes)
    setSessions((prev) => [...prev, ...result.sessions])
  }

  const handleConnectPane = async (paneId: string): Promise<void> => {
    const result = await reconnectMosaicPane(panes, paneId)
    if (!result) return
    setPanes(result.panes)
    upsertSession(result.session)
  }

  const handleClosePane = (paneId: string): void => {
    const { layout: nextLayout, panes: nextPanes } = closeMosaicPane(layout, panes, paneId)
    setLayout(nextLayout)
    setPanes(nextPanes)
    setSessions((prev) => {
      const closedIds = new Set(
        panes.filter((p) => p.paneId === paneId && p.sessionId).map((p) => p.sessionId!)
      )
      return prev.filter((s) => !closedIds.has(s.id))
    })

    if (nextPanes.length === 0) {
      window.close()
    }
  }

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">No session</div>
    )
  }

  if (initError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">{initError}</div>
    )
  }

  if (!layout) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading…</div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SessionMosaic
        layout={layout}
        panes={panes}
        sessions={sessions}
        onLayoutChange={(next) => setLayout(next)}
        onPanesChange={setPanes}
        onSessionUpdated={upsertSession}
        onSessionRemoved={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
        onSplitPane={handleSplitPane}
        onConnectPane={handleConnectPane}
        onClosePane={handleClosePane}
        emptyLayoutView={
          <div className="flex h-full items-center justify-center text-sm text-gray-500">No session</div>
        }
      />
    </div>
  )
}
