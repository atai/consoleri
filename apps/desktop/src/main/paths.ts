import { app } from 'electron'
import { join } from 'path'

/**
 * Returns the directory where all app data (SQLite DB, Electron localStorage,
 * IndexedDB, cookies) should be stored.
 *
 * Used once at startup via app.setPath('userData', getDataDir()), which causes
 * Electron to route all its storage APIs to this location automatically.
 *
 *   Packaged : C:\Users\<user>\.consoleri\   (or ~/.consoleri on macOS/Linux)
 *   Dev      : apps/desktop/.consoleri-dev\  (gitignored, isolated from production)
 *   Override : CONSOLERI_DATA_DIR env var    (useful for CI, migration testing)
 */
export function getDataDir(): string {
  if (process.env.CONSOLERI_DATA_DIR) {
    return process.env.CONSOLERI_DATA_DIR
  }
  if (app.isPackaged) {
    return join(app.getPath('home'), '.consoleri')
  }
  // Dev: stored next to package.json so it does not pollute the user profile.
  return join(app.getAppPath(), '.consoleri-dev')
}
