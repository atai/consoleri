import { useEffect, useState } from 'react'
import { NavRail } from './NavRail'
import { ResizableSidebar } from './ResizableSidebar'
import { Sidebar } from './Sidebar'
import { MosaicWorkspace } from '../workspace/MosaicWorkspace'
import { HostMapView } from '../map/HostMapView'
import { UxProfileManager } from '../ux/UxProfileManager'
import { useAppStore } from '../../stores/appStore'
import { useUxProfileStore } from '../../stores/uxProfileStore'

interface AppShellProps {
  workspaceReady: boolean
}

export function AppShell({ workspaceReady }: AppShellProps): React.JSX.Element {
  const {
    appView,
    loadMapView,
    mapViewLoaded,
    refreshAllHosts,
    addSession,
    updateSession,
    removeSession,
    settings
  } = useAppStore()
  const refreshUxProfiles = useUxProfileStore((s) => s.refresh)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    void loadMapView().then(() => setBootstrapped(true))
    void refreshUxProfiles()
  }, [loadMapView, refreshUxProfiles])

  useEffect(() => {
    if (!mapViewLoaded) return
    if (appView === 'map') {
      void refreshAllHosts()
    }
  }, [appView, mapViewLoaded, refreshAllHosts])

  useEffect(() => {
    const unsubExit = window.consoleri.sessions.onExit(({ id }) => {
      const { workspace } = useAppStore.getState()
      const inWorkspace = workspace.panes.some((p) => p.sessionId === id)
      if (inWorkspace) {
        updateSession(id, { status: 'disconnected' })
      } else {
        removeSession(id)
      }
    })
    const unsubStatus = window.consoleri.sessions.onStatus(({ id, status, error }) => {
      updateSession(id, {
        status: status as 'connecting' | 'connected' | 'disconnected' | 'error',
        error
      })
    })

    window.consoleri.sessions.list().then((sessions) => {
      sessions.forEach((s) => addSession(s))
    })

    return () => {
      unsubExit()
      unsubStatus()
    }
  }, [addSession, updateSession, removeSession])

  if (!bootstrapped) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f1117] text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  const listUsesWindows = settings.sessionOpenMode === 'window'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-gray-100">
      <NavRail />
      {appView === 'list' && (
        <>
          <ResizableSidebar expanded={listUsesWindows}>
            <Sidebar />
          </ResizableSidebar>
          {!listUsesWindows && (
            <main className="min-h-0 min-w-0 flex-1">
              {workspaceReady ? (
                <MosaicWorkspace />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading workspace…
                </div>
              )}
            </main>
          )}
        </>
      )}
      {appView === 'map' && (
        <main className="min-h-0 min-w-0 flex-1">
          <HostMapView />
        </main>
      )}
      {appView === 'profile' && (
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#161b22]">
          <UxProfileManager />
        </main>
      )}
    </div>
  )
}
