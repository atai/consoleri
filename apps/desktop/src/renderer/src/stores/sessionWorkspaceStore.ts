import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import type { SessionInfo, WorkspaceState, PaneBinding } from '@shared/types'

const LAYOUT_SAVE_DEBOUNCE_MS = 300
let layoutSaveTimer: ReturnType<typeof setTimeout> | null = null

interface SessionWorkspaceState {
  sessions: SessionInfo[]
  workspace: WorkspaceState
  addSession: (session: SessionInfo) => void
  updateSession: (id: string, patch: Partial<SessionInfo>) => void
  removeSession: (id: string) => void
  setWorkspace: (ws: WorkspaceState) => void
  persistWorkspace: (
    layout: MosaicNode<string> | null,
    panes: PaneBinding[],
    options?: { debounce?: boolean }
  ) => void
}

export const useSessionWorkspaceStore = create<SessionWorkspaceState>((set, get) => ({
  sessions: [],
  workspace: { layout: null, panes: [] },
  addSession: (session) => set({ sessions: [...get().sessions, session] }),
  updateSession: (id, patch) =>
    set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
  removeSession: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
  setWorkspace: (workspace) => set({ workspace }),
  persistWorkspace: (layout, panes, options) => {
    const state: WorkspaceState = { layout, panes }
    set({ workspace: state })
    if (options?.debounce) {
      if (layoutSaveTimer) clearTimeout(layoutSaveTimer)
      layoutSaveTimer = setTimeout(() => {
        layoutSaveTimer = null
        void window.consoleri.workspace.save(state)
      }, LAYOUT_SAVE_DEBOUNCE_MS)
      return
    }
    if (layoutSaveTimer) {
      clearTimeout(layoutSaveTimer)
      layoutSaveTimer = null
    }
    void window.consoleri.workspace.save(state)
  }
}))

export function flushWorkspacePersist(): void {
  if (layoutSaveTimer) {
    clearTimeout(layoutSaveTimer)
    layoutSaveTimer = null
  }
  const { workspace } = useSessionWorkspaceStore.getState()
  void window.consoleri.workspace.save(workspace)
}
