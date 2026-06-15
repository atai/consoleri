import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnPnpm } from './pnpm.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopDir = join(root, 'apps', 'desktop')
const electronPaths = [
  join(root, 'node_modules', 'electron'),
  join(desktopDir, 'node_modules', 'electron')
]

if (!electronPaths.some(existsSync)) {
  console.log('[rebuild-native] electron not installed yet, skipping')
  process.exit(0)
}

console.log('[rebuild-native] pnpm exec @electron/rebuild …')
const result = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    'exec',
    '@electron/rebuild',
    '-f',
    '-w',
    'node-pty',
    '-m',
    desktopDir
  ],
  { cwd: root, stdio: 'inherit' }
)

if (result.status !== 0) {
  // fallback via spawnPnpm if direct path fails
  const code = spawnPnpm([
    'exec',
    '@electron/rebuild',
    '-f',
    '-w',
    'node-pty',
    '-m',
    desktopDir
  ])
  if (code !== 0) {
    console.warn('[rebuild-native] node-pty rebuild failed — terminal may not work until rebuilt')
  }
}
