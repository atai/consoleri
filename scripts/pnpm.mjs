import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pnpmCjs = join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')

export function resolvePnpmCli() {
  if (existsSync(pnpmCjs)) {
    return { command: process.execPath, argsPrefix: [pnpmCjs] }
  }

  const binName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const binPath = join(root, 'node_modules', '.bin', binName)
  if (existsSync(binPath)) {
    return { command: binPath, argsPrefix: [] }
  }

  return null
}

/** @returns {number} exit code */
export function spawnPnpm(args, cwd = root) {
  const cli = resolvePnpmCli()
  if (!cli) {
    console.error('[pnpm] Not found in node_modules. Bootstrap with: npx pnpm install')
    return 1
  }

  const result = spawnSync(cli.command, [...cli.argsPrefix, ...args], {
    cwd,
    stdio: 'inherit',
    shell: cli.argsPrefix.length === 0
  })

  return result.status ?? 1
}

export function runPnpm(args, cwd = root) {
  process.exit(spawnPnpm(args, cwd))
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  runPnpm(process.argv.slice(2))
}
