export const MAP_VIEW_VERSION = 1

export type MapViewMode = 'logical' | 'network'
export type AppView = 'list' | 'map' | 'profile' | 'reports' | 'vault'

export interface MapViewSettings {
  version: number
  appView: AppView
  mapMode: MapViewMode
}

export const DEFAULT_MAP_VIEW: MapViewSettings = {
  version: MAP_VIEW_VERSION,
  appView: 'list',
  mapMode: 'logical'
}

export function normalizeMapViewSettings(input: unknown): MapViewSettings {
  if (typeof input !== 'object' || input === null) {
    return { ...DEFAULT_MAP_VIEW }
  }
  const raw = input as Partial<MapViewSettings>
  const appView =
    raw.appView === 'map' ||
    raw.appView === 'profile' ||
    raw.appView === 'list' ||
    raw.appView === 'reports'
      ? raw.appView
      : DEFAULT_MAP_VIEW.appView
  const mapMode =
    raw.mapMode === 'network' || raw.mapMode === 'logical'
      ? raw.mapMode
      : DEFAULT_MAP_VIEW.mapMode
  return { version: MAP_VIEW_VERSION, appView, mapMode }
}

export function parseMapViewJson(raw: string | undefined | null): MapViewSettings {
  if (!raw) return { ...DEFAULT_MAP_VIEW }
  try {
    return normalizeMapViewSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_MAP_VIEW }
  }
}

export function mergeMapViewSettings(
  current: MapViewSettings,
  patch: Partial<MapViewSettings>
): MapViewSettings {
  return normalizeMapViewSettings({ ...current, ...patch, version: MAP_VIEW_VERSION })
}
