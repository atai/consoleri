import {
  mergeHostListViewSettings,
  mergeMapViewSettings,
  normalizeHostListViewSettings,
  normalizeMapViewSettings,
  parseHostListViewJson,
  parseMapViewJson,
  type HostListViewSettings,
  type MapViewSettings
} from '@consoleri/core'
import { getDatabase } from '../db/database'

const HOST_LIST_VIEW_KEY = 'host_list_view'
const MAP_VIEW_KEY = 'map_view'

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

  getMapView(): MapViewSettings {
    const db = getDatabase()
    const pref = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(MAP_VIEW_KEY) as { value: string } | undefined
    const normalized = parseMapViewJson(pref?.value)
    if (pref?.value) {
      try {
        const parsed = JSON.parse(pref.value)
        const repaired = normalizeMapViewSettings(parsed)
        if (JSON.stringify(repaired) !== JSON.stringify(parsed)) {
          this.writeMapView(repaired)
        }
      } catch {
        this.writeMapView(normalized)
      }
    }
    return normalized
  }

  setMapView(patch: Partial<MapViewSettings>): MapViewSettings {
    const current = this.getMapView()
    const merged = mergeMapViewSettings(current, patch)
    this.writeMapView(merged)
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

  private writeMapView(settings: MapViewSettings): void {
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(MAP_VIEW_KEY, JSON.stringify(settings))
  }
}

export const appPreferencesRepository = new AppPreferencesRepository()
