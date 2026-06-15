import { join } from 'path'

export const APP_NAME = 'Consoleri'

export function appIconPath(): string {
  return join(__dirname, '../../build/icon.png')
}
