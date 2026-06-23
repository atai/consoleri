import { nanoid } from 'nanoid'
import type { OpenSessionRequest, PaneBinding, Workspace, WorkspaceState } from '../../shared/types'
import { getDatabase } from '../db/database'

export class WorkspaceRepository {
  getActiveWorkspace(): Workspace {
    const row = getDatabase()
      .prepare('SELECT * FROM workspaces WHERE is_last_active = 1 LIMIT 1')
      .get() as Record<string, unknown> | undefined
    if (!row) {
      const id = nanoid()
      getDatabase()
        .prepare(`INSERT INTO workspaces (id, name, layout_json, is_last_active) VALUES (?, ?, ?, 1)`)
        .run(id, 'Default', 'null')
      return { id, name: 'Default', layoutJson: 'null', isLastActive: true }
    }
    return {
      id: row.id as string,
      name: row.name as string,
      layoutJson: row.layout_json as string,
      isLastActive: Boolean(row.is_last_active)
    }
  }

  saveWorkspace(state: WorkspaceState, name = 'Default'): Workspace {
    const db = getDatabase()
    const existing = this.getActiveWorkspace()
    const layoutJson = JSON.stringify({ layout: state.layout, panes: state.panes })

    db.prepare(`UPDATE workspaces SET is_last_active = 0`).run()
    db.prepare(
      `UPDATE workspaces SET name=?, layout_json=?, is_last_active=1 WHERE id=?`
    ).run(name, layoutJson, existing.id)

    db.prepare(`DELETE FROM workspace_panes WHERE workspace_id = ?`).run(existing.id)
    const insertPane = db.prepare(
      `INSERT INTO workspace_panes (id, workspace_id, pane_id, session_snapshot_json) VALUES (?, ?, ?, ?)`
    )
    for (const pane of state.panes) {
      insertPane.run(nanoid(), existing.id, pane.paneId, JSON.stringify(pane))
    }

    return this.getActiveWorkspace()
  }

  loadWorkspace(): WorkspaceState {
    const ws = this.getActiveWorkspace()
    try {
      const parsed = JSON.parse(ws.layoutJson) as WorkspaceState
      if (parsed && 'layout' in parsed) {
        return {
          layout: parsed.layout,
          panes: (parsed.panes ?? []).map((pane) => this.migratePaneBinding(pane))
        }
      }
    } catch {
      /* fall through */
    }
    return { layout: null, panes: [] }
  }

  private migratePaneBinding(raw: PaneBinding): PaneBinding {
    let connectRequest: OpenSessionRequest = raw.connectRequest ?? {}
    if (!raw.connectRequest && raw.sessionId) {
      const snap = this.getSessionSnapshot(raw.sessionId)
      if (snap) {
        connectRequest = {
          hostId: snap.hostId ?? undefined,
          profileId: snap.profileId ?? undefined,
          protocol: snap.protocol as OpenSessionRequest['protocol'],
          title: snap.title
        }
      }
    }
    if (!connectRequest.title && raw.title) {
      connectRequest = { ...connectRequest, title: raw.title }
    }
    return {
      paneId: raw.paneId,
      sessionId: null,
      protocol: raw.protocol,
      title: raw.title,
      connectRequest
    }
  }

  saveSessionSnapshot(snapshot: {
    id: string
    hostId: string | null
    profileId: string | null
    protocol: string
    title: string
    cwd: string | null
    cols: number
    rows: number
    scrollbackSerialized: string | null
  }): void {
    getDatabase()
      .prepare(
        `INSERT OR REPLACE INTO session_snapshots (id, host_id, profile_id, protocol, title, cwd, cols, rows, scrollback_serialized, disconnected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        snapshot.id,
        snapshot.hostId,
        snapshot.profileId,
        snapshot.protocol,
        snapshot.title,
        snapshot.cwd,
        snapshot.cols,
        snapshot.rows,
        snapshot.scrollbackSerialized,
        new Date().toISOString()
      )
  }

  getSessionSnapshot(id: string) {
    const row = getDatabase().prepare('SELECT * FROM session_snapshots WHERE id = ?').get(id)
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      hostId: (r.host_id as string) || null,
      profileId: (r.profile_id as string) || null,
      protocol: r.protocol as string,
      title: r.title as string,
      cwd: (r.cwd as string) || null,
      cols: r.cols as number,
      rows: r.rows as number,
      scrollbackSerialized: (r.scrollback_serialized as string) || null,
      disconnectedAt: (r.disconnected_at as string) || null
    }
  }
}

export const workspaceRepository = new WorkspaceRepository()
