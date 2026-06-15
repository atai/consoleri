import { useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { MosaicWorkspace } from './components/workspace/MosaicWorkspace'
import { ResizableSidebar } from './components/layout/ResizableSidebar'
import { useAppStore } from './stores/appStore'
import { useUxProfileStore } from './stores/uxProfileStore'
import './assets/app.css'

function App(): React.JSX.Element {
  const { addSession, updateSession, setWorkspace, refreshHosts } = useAppStore()
  const refreshUxProfiles = useUxProfileStore((s) => s.refresh)
  const [workspaceReady, setWorkspaceReady] = useState(false)

  useEffect(() => {
    void refreshHosts()
    void refreshUxProfiles()
  }, [refreshHosts, refreshUxProfiles])

  useEffect(() => {
    window.consoleri.workspace.load().then((ws) => {
      if (ws) setWorkspace(ws)
      setWorkspaceReady(true)
    })
  }, [setWorkspace])

  useEffect(() => {
    const unsubData = window.consoleri.sessions.onData(() => {
      /* handled per-pane in TerminalPane */
    })
    const unsubExit = window.consoleri.sessions.onExit(({ id }) => {
      updateSession(id, { status: 'disconnected' })
    })
    const unsubStatus = window.consoleri.sessions.onStatus(({ id, status, error }) => {
      updateSession(id, {
        status: status as 'connecting' | 'connected' | 'disconnected' | 'error',
        error
      })
    })
    const unsubLog = window.consoleri.sessions.onLog(() => {
      /* consumed by log window */
    })

    window.consoleri.sessions.list().then((sessions) => {
      sessions.forEach((s) => addSession(s))
    })

    return () => {
      unsubData()
      unsubExit()
      unsubStatus()
      unsubLog()
    }
  }, [addSession, updateSession])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-gray-100">
      <ResizableSidebar>
        <Sidebar />
      </ResizableSidebar>
      <main className="min-h-0 min-w-0 flex-1">
        {workspaceReady ? (
          <MosaicWorkspace />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Loading workspace…
          </div>
        )}
      </main>
    </div>
  )
}

export default App
