import type { OsType } from '@shared/types'

export function osIcon(os: OsType | string): string {
  switch (os) {
    case 'windows':
      return '🪟'
    case 'linux':
      return '🐧'
    case 'macos':
      return '🍎'
    default:
      return '💻'
  }
}
