import {
  mergeHostListViewSettings,
  normalizeHostListViewSettings,
  parseHostListViewJson,
  type HostListViewSettings
} from '@consoleri/core'
import { getDatabase } from '../db/database'

const HOST_LIST_VIEW_KEY = 'host_list_view'

function serializeHostListView(settings: HostListViewSettings): string {
  return JSON.stringify(settings)
}

export class AppPreferencesRepository {
  getHostListView(): HostListViewSettings {
    const db = getDatabase()
    const pref = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(HOST_LIST_VIEW_KEY) as { value: string } | undefined

    const normalized = parseHostListViewJson(pref?.value)
    if (pref?.value) {
      try {
        const parsed = JSON.parse(pref.value)
        const repaired = normalizeHostListViewSettings(parsed)
        if (JSON.stringify(repaired) !== JSON.stringify(parsed)) {
          this.writeHostListView(repaired)
        }
      } catch {
        this.writeHostListView(normalized)
      }
    }
    return normalized
  }

  setHostListView(patch: Partial<HostListViewSettings>): HostListViewSettings {
    const current = this.getHostListView()
    const merged = mergeHostListViewSettings(current, patch)
    this.writeHostListView(merged)
    return merged
  }

  private writeHostListView(settings: HostListViewSettings): void {
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(HOST_LIST_VIEW_KEY, serializeHostListView(settings))
  }
}

export const appPreferencesRepository = new AppPreferencesRepository()
