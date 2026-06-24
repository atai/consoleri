import winIcon from '../../build/icon.ico?asset'
import macIcon from '../../build/icon.icns?asset'
import linuxIcon from '../../build/icon.png?asset'

export { APP_NAME } from './appName'

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
