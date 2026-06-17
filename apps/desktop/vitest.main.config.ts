import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@consoleri/core': path.resolve(__dirname, '../../packages/core/src/index.ts')
    }
  }
})
