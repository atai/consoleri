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
import type { AppSettings } from '../../shared/types'

const HOST_LIST_VIEW_KEY = 'host_list_view'
const MAP_VIEW_KEY = 'map_view'
const APP_SETTINGS_KEY = 'app_settings'

const DEFAULT_APP_SETTINGS: AppSettings = {
  autoOpenConnectionLog: false,
  sessionOpenMode: 'workspace'
}

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

  getAppSettings(): AppSettings {
    const db = getDatabase()
    const pref = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(APP_SETTINGS_KEY) as { value: string } | undefined
    if (!pref?.value) return { ...DEFAULT_APP_SETTINGS }
    try {
      const parsed = JSON.parse(pref.value) as Partial<AppSettings>
      return {
        autoOpenConnectionLog: parsed.autoOpenConnectionLog ?? DEFAULT_APP_SETTINGS.autoOpenConnectionLog,
        sessionOpenMode:
          parsed.sessionOpenMode === 'window' ? 'window' : DEFAULT_APP_SETTINGS.sessionOpenMode
      }
    } catch {
      return { ...DEFAULT_APP_SETTINGS }
    }
  }

  setAppSettings(patch: Partial<AppSettings>): AppSettings {
    const merged: AppSettings = { ...this.getAppSettings(), ...patch }
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(APP_SETTINGS_KEY, JSON.stringify(merged))
    return merged
  }
}

export const appPreferencesRepository = new AppPreferencesRepository()
