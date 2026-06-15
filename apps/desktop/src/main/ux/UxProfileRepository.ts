import { nanoid } from 'nanoid'
import {
  BUILTIN_UX_PROFILE_ID,
  createBuiltinUxProfile,
  normalizeUxProfileInput,
  normalizeUxProfileSettings,
  rowToHost
} from '@consoleri/core'
import type { UxProfile, UxProfileInput, UxProfileSettings } from '@consoleri/core'
import type { Host } from '../../shared/types'
import { getDatabase } from '../db/database'

const ACTIVE_UX_PROFILE_KEY = 'active_ux_profile_id'

function rowToUxProfile(row: Record<string, unknown>): UxProfile {
  const settings = normalizeUxProfileSettings(
    JSON.parse((row.settings_json as string) || '{}') as Partial<UxProfileSettings>
  )
  return {
    id: row.id as string,
    name: row.name as string,
    terminal: settings.terminal,
    chrome: settings.chrome,
    isBuiltin: Boolean(row.is_builtin),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function serializeSettings(profile: Pick<UxProfile, 'terminal' | 'chrome'>): string {
  return JSON.stringify({
    terminal: profile.terminal,
    chrome: profile.chrome
  } satisfies UxProfileSettings)
}

export class UxProfileRepository {
  list(hostId?: string): UxProfile[] {
    const db = getDatabase()
    if (hostId) {
      const host = db.prepare('SELECT ux_profile_id FROM hosts WHERE id = ?').get(hostId) as
        | { ux_profile_id: string | null }
        | undefined
      if (!host?.ux_profile_id) return []
      const row = db.prepare('SELECT * FROM ux_profiles WHERE id = ?').get(host.ux_profile_id)
      return row ? [rowToUxProfile(row as Record<string, unknown>)] : []
    }
    const rows = db.prepare('SELECT * FROM ux_profiles ORDER BY is_builtin DESC, name COLLATE NOCASE').all()
    return rows.map((row) => rowToUxProfile(row as Record<string, unknown>))
  }

  get(id: string): UxProfile | null {
    const row = getDatabase().prepare('SELECT * FROM ux_profiles WHERE id = ?').get(id)
    return row ? rowToUxProfile(row as Record<string, unknown>) : null
  }

  getActive(): UxProfile {
    const db = getDatabase()
    const pref = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(ACTIVE_UX_PROFILE_KEY) as { value: string } | undefined
    if (pref?.value) {
      const profile = this.get(pref.value)
      if (profile) return profile
    }
    return this.get(BUILTIN_UX_PROFILE_ID) ?? createBuiltinUxProfile()
  }

  getActiveId(): string {
    const db = getDatabase()
    const pref = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(ACTIVE_UX_PROFILE_KEY) as { value: string } | undefined
    return pref?.value ?? BUILTIN_UX_PROFILE_ID
  }

  setActive(id: string): UxProfile {
    const profile = this.get(id)
    if (!profile) throw new Error(`UX profile not found: ${id}`)
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(ACTIVE_UX_PROFILE_KEY, id)
    return profile
  }

  async create(input: UxProfileInput): Promise<UxProfile> {
    const normalized = normalizeUxProfileInput(input)
    const id = nanoid()
    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `INSERT INTO ux_profiles (id, name, settings_json, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run(id, normalized.name, serializeSettings(normalized), now, now)
    return this.get(id)!
  }

  async update(id: string, input: Partial<UxProfileInput>): Promise<UxProfile> {
    const existing = this.get(id)
    if (!existing) throw new Error(`UX profile not found: ${id}`)
    const merged = normalizeUxProfileInput({
      name: input.name ?? existing.name,
      terminal: input.terminal ?? existing.terminal,
      chrome: input.chrome ?? existing.chrome
    })
    const now = new Date().toISOString()
    getDatabase()
      .prepare(`UPDATE ux_profiles SET name=?, settings_json=?, updated_at=? WHERE id=?`)
      .run(merged.name, serializeSettings(merged), now, id)
    return this.get(id)!
  }

  delete(id: string): void {
    const existing = this.get(id)
    if (!existing) return
    if (existing.isBuiltin) throw new Error('Cannot delete built-in UX profile')
    const db = getDatabase()
    db.prepare('UPDATE hosts SET ux_profile_id = NULL WHERE ux_profile_id = ?').run(id)
    db.prepare('DELETE FROM ux_profiles WHERE id = ?').run(id)
    const activeId = this.getActiveId()
    if (activeId === id) {
      this.setActive(BUILTIN_UX_PROFILE_ID)
    }
  }

  async duplicate(sourceId: string, name?: string): Promise<UxProfile> {
    const source = this.get(sourceId)
    if (!source) throw new Error(`UX profile not found: ${sourceId}`)
    return this.create({
      name: name ?? `${source.name} (copy)`,
      terminal: source.terminal,
      chrome: source.chrome
    })
  }

  listHosts(profileId: string): Host[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM hosts WHERE ux_profile_id = ? ORDER BY name COLLATE NOCASE')
      .all(profileId)
    return rows.map((row) => rowToHost(row as Record<string, unknown>))
  }

  linkHost(hostId: string, profileId: string): void {
    if (!this.get(profileId)) throw new Error(`UX profile not found: ${profileId}`)
    getDatabase().prepare('UPDATE hosts SET ux_profile_id = ? WHERE id = ?').run(profileId, hostId)
  }

  unlinkHost(hostId: string): void {
    getDatabase().prepare('UPDATE hosts SET ux_profile_id = NULL WHERE id = ?').run(hostId)
  }
}

export const uxProfileRepository = new UxProfileRepository()
