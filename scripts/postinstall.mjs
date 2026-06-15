import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electronExe = join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const electronApp = join(root, 'node_modules', 'electron', 'dist', 'Electron.app')

if (existsSync(electronExe) || existsSync(electronApp)) {
  console.log('[postinstall] Electron binary already present')
  process.exit(0)
}

console.log('[postinstall] Downloading Electron binary…')
const result = spawnSync(process.execPath, [join(root, 'node_modules', 'electron', 'install.js')], {
  cwd: root,
  stdio: 'inherit'
})

process.exit(result.status ?? 1)
