import { is } from '@electron-toolkit/utils'
import { nativeImage, type NativeImage } from 'electron'
import winIcon from '../../build/icon.ico?asset'
import macIcon from '../../build/icon.icns?asset'
import linuxIcon from '../../build/icon.png?asset'

export const APP_NAME = 'Consoleri'

export function appIconPath(): string {
  switch (process.platform) {
    case 'win32':
      return winIcon
    case 'darwin':
      return macIcon
    default:
      return linuxIcon
  }
}

export function appIcon(): NativeImage {
  const image = nativeImage.createFromPath(appIconPath())
  if (image.isEmpty() && is.dev) {
    console.warn(`[appBranding] Failed to load app icon from ${appIconPath()}`)
  }
  return image
}
