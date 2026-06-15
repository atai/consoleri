import { useEffect } from 'react'
import { HostBrowser } from './components/hosts/HostBrowser'
import { MosaicWorkspace } from './components/workspace/MosaicWorkspace'
import { useAppStore } from './stores/appStore'
import './assets/app.css'

function App(): React.JSX.Element {
  const { addSession, updateSession } = useAppStore()

  useEffect(() => {
    const unsubData = window.consoleri.sessions.onData(() => {
      /* handled per-pane in TerminalPane */
    })
    const unsubExit = window.consoleri.sessions.onExit(({ id }) => {
      updateSession(id, { status: 'disconnected' })
    })
    const unsubStatus = window.consoleri.sessions.onStatus(({ id, status, error }) => {
      updateSession(id, { status: status as 'connecting' | 'connected' | 'disconnected' | 'error', error })
    })

    window.consoleri.sessions.list().then((sessions) => {
      sessions.forEach((s) => addSession(s))
    })

    return () => {
      unsubData()
      unsubExit()
      unsubStatus()
    }
  }, [addSession, updateSession])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-gray-100">
      <HostBrowser />
      <main className="min-w-0 flex-1">
        <MosaicWorkspace />
      </main>
    </div>
  )
}

export default App
