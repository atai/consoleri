import initIronRdp, { setup } from 'ironrdp-wasm'
// Resolved via electron.vite.config.ts alias — package exports omit the wasm subpath.
import wasmUrl from '@ironrdp-wasm-bg?url'

let initPromise: Promise<void> | null = null

export async function ensureIronRdpReady(): Promise<typeof import('ironrdp-wasm')> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initIronRdp(wasmUrl)
        setup('info')
      } catch (err) {
        initPromise = null
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`Failed to initialize RDP client (WASM): ${message}`)
      }
    })()
  }

  await initPromise
  return import('ironrdp-wasm')
}

export { formatIronError, logRdpError } from './rdpErrors'
