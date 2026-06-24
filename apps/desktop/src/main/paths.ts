import { app } from 'electron'
import { join, resolve } from 'path'

/**
 * Returns the directory where all app data (SQLite DB, Electron localStorage,
 * IndexedDB, cookies) should be stored.
 *
 * Priority: CONSOLERI_DATA_DIR env var → default for the current mode.
 *
 *   Packaged  : ~/.consoleri   (default; override with CONSOLERI_DATA_DIR for portable install, CI, etc.)
 *   Dev       : apps/desktop/.consoleri-dev   (gitignored, isolated from production by default)
 *   Any mode  : CONSOLERI_DATA_DIR   (explicit override; user's responsibility)
 *
 * Guard: in dev mode only, pointing CONSOLERI_DATA_DIR at the production directory
 * is rejected with an error to prevent accidental data corruption when both the
 * installed app and dev build run on the same machine.
 */

export function getProductionDataDir(): string {
  return join(app.getPath('home'), '.consoleri')
}

export function getDefaultDataDir(): string {
  return app.isPackaged
    ? getProductionDataDir()
    : join(app.getAppPath(), '.consoleri-dev')
}

export function getDataDir(): string {
  // Always return an absolute path — app.setPath('userData', ...) requires it.
  // Relative paths in CONSOLERI_DATA_DIR are resolved against process.cwd().
  const dir = resolve(process.env.CONSOLERI_DATA_DIR ?? getDefaultDataDir())

  if (!app.isPackaged && dir === resolve(getProductionDataDir())) {
    throw new Error(
      `CONSOLERI_DATA_DIR must not point to the production data directory in dev mode.\n` +
        `  dir: ${resolve(dir)}\n` +
        `  production: ${resolve(getProductionDataDir())}`
    )
  }

  return dir
}
