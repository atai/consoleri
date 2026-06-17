declare module '@ironrdp-wasm-bg?url' {
  const url: string
  export default url
}

import { ElectronAPI } from '@electron-toolkit/preload'
import type { ConsoleriAPI } from '../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI
    consoleri: ConsoleriAPI
  }
}

export {}
