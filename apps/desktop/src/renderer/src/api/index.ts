/**
 * IPC facade over window.consoleri.
 *
 * Provides a single, injectable access point for the Electron IPC API so that
 * unit tests can replace it with a mock via setConsoleriApi() instead of
 * stubbing the global window object.
 */
import type { ConsoleriAPI } from '../../../preload/index'

let _override: ConsoleriAPI | null = null

/**
 * Returns the active API instance. In production this is window.consoleri;
 * in tests it may be a mock injected via setConsoleriApi().
 */
export function getConsoleriApi(): ConsoleriAPI {
  return _override ?? window.consoleri
}

/**
 * Override the API instance used by getConsoleriApi(). Intended for tests only.
 * Pass null to restore the real window.consoleri.
 */
export function setConsoleriApi(api: ConsoleriAPI | null): void {
  _override = api
}
