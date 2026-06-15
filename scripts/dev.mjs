import { spawnPnpm } from './pnpm.mjs'

console.log('[dev] Building latest app…')
const buildCode = spawnPnpm(['--filter', '@consoleri/desktop', 'run', 'build:app'])
if (buildCode !== 0) process.exit(buildCode)

console.log('[dev] Starting dev server…')
process.exit(spawnPnpm(['--filter', '@consoleri/desktop', 'run', 'dev:watch']))
