import { ElectronAPI } from '@electron-toolkit/preload'
import type { ConsoleriAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    consoleri: ConsoleriAPI
  }
}

export {}
