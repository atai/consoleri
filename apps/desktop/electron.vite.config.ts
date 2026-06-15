import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const coreSrc = resolve(__dirname, '../../packages/core/src')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@consoleri/core'] })],
    resolve: {
      alias: {
        '@consoleri/core': coreSrc
      }
    },
    build: {
      rollupOptions: {
        external: ['node-pty', 'ssh2', 'cpu-features', 'node:sqlite']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          log: resolve('src/preload/log.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@consoleri/core': coreSrc
      }
    },
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['ironrdp-wasm']
    },
    assetsInclude: ['**/*.wasm'],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          'log-window/index': resolve('src/renderer/log-window/index.html')
        }
      }
    }
  }
})
