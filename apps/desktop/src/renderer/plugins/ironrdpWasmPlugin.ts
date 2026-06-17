import fs from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const WASM_IMPORT = '@ironrdp-wasm-bg'

export function ironrdpWasmPlugin(desktopDir: string): Plugin {
  const wasmPath = resolve(desktopDir, '../../node_modules/ironrdp-wasm/pkg/rdp_client_bg.wasm')

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`ironrdp-wasm background module not found: ${wasmPath}`)
  }

  return {
    name: 'ironrdp-wasm-bg',
    enforce: 'pre',
    resolveId(source) {
      const base = source.split('?')[0]
      if (base === WASM_IMPORT) {
        return wasmPath
      }
      return null
    }
  }
}
