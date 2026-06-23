import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { ironrdpWasmPlugin } from './src/renderer/plugins/ironrdpWasmPlugin'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/types.ts'
      ],
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage/renderer'
    }
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
