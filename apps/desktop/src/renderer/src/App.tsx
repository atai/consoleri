import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useAppStore } from './stores/appStore'
import { useSessionWorkspaceStore } from './stores/sessionWorkspaceStore'
import { useUxProfileStore } from './stores/uxProfileStore'
import './assets/app.css'

function App(): React.JSX.Element {
  const { refreshHosts } = useAppStore()
  const { setWorkspace } = useSessionWorkspaceStore()
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

  return <AppShell workspaceReady={workspaceReady} />
}

export default App
