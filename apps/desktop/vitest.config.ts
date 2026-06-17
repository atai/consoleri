import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { ironrdpWasmPlugin } from './src/renderer/plugins/ironrdpWasmPlugin'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.test.ts']
  },
  plugins: [ironrdpWasmPlugin(__dirname)],
  resolve: {
    alias: {
      '@consoleri/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@renderer': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
})
