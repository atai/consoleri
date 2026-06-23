import { ElectronAPI } from '@electron-toolkit/preload'
import type { ConsoleriAPI } from '../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI
    consoleri: ConsoleriAPI
  }
}

export {}
