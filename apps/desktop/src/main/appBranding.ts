import { app } from 'electron'
import { join } from 'path'

export const APP_NAME = 'Consoleri'

export function appIconPath(): string {
  if (app.isPackaged) {
    // In the packaged app, icon.ico is placed outside the ASAR via extraResources.
    return join(process.resourcesPath, 'icon.ico')
  }
  // Dev: __dirname = out/main/ → ../../build/ = apps/desktop/build/
  return join(__dirname, '../../build/icon.ico')
}
