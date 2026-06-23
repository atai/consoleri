import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/main/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/types.ts'
      ],
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage/main'
    }
  },
  resolve: {
    alias: {
      '@consoleri/core': path.resolve(__dirname, '../../packages/core/src/index.ts')
    }
  }
})
