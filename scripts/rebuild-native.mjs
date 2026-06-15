import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopDir = join(root, 'apps', 'desktop')
const electronPath = join(desktopDir, 'node_modules', 'electron')

if (!existsSync(electronPath)) {
  console.log('[rebuild-native] electron not installed yet, skipping')
  process.exit(0)
}

const args = ['@electron/rebuild', '-f', '-w', 'node-pty', '-m', desktopDir]

console.log('[rebuild-native]', 'npx', args.join(' '))
const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true
})

if (result.status !== 0) {
  console.warn('[rebuild-native] node-pty rebuild failed — terminal may not work until rebuilt')
  process.exit(0)
}
