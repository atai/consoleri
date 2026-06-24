import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PACKAGE_FILES = [
  join(root, 'package.json'),
  join(root, 'apps/desktop/package.json'),
  join(root, 'packages/core/package.json'),
]

const APP_VERSION_FILE = join(root, 'apps/desktop/src/shared/appVersion.ts')

const BUMP_TYPES = new Set(['patch', 'minor', 'major'])

function readVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_FILES[0], 'utf8'))
  const version = pkg.version
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version in package.json: ${version}`)
  }
  return version
}

function bumpSemver(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number)
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Unknown bump type: ${bumpType}`)
  }
}

function setAppVersion(version) {
  const content = readFileSync(APP_VERSION_FILE, 'utf8')
  const updated = content.replace(
    /^export const APP_VERSION = '[^']*'$/m,
    `export const APP_VERSION = '${version}'`
  )
  if (updated === content) {
    throw new Error(`Could not update APP_VERSION in ${APP_VERSION_FILE} — pattern not found`)
  }
  writeFileSync(APP_VERSION_FILE, updated, 'utf8')
}

function setVersion(version) {
  for (const file of PACKAGE_FILES) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    pkg.version = version
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  }
  setAppVersion(version)
}

function usage() {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z> [--dry-run]')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const bumpArg = args.find((arg) => arg !== '--dry-run')

if (!bumpArg) {
  usage()
}

const currentVersion = readVersion()
let newVersion

if (BUMP_TYPES.has(bumpArg)) {
  newVersion = bumpSemver(currentVersion, bumpArg)
} else if (/^\d+\.\d+\.\d+$/.test(bumpArg)) {
  newVersion = bumpArg
} else {
  usage()
}

if (dryRun) {
  console.log(newVersion)
  process.exit(0)
}

setVersion(newVersion)
console.log(newVersion)
