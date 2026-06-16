# Consoleri

Monorepo for Consoleri — a desktop host console manager (SSH, shells, RDP, VNC).

## Structure

- `apps/desktop` — Electron application (`@consoleri/desktop`)
- `packages/core` — shared pure functions (`@consoleri/core`)
- `scripts/` — root tooling (dev launcher, native rebuild, etc.)

## Prerequisites

- Node.js 20+

pnpm is bundled in the repo (`devDependencies`). You do **not** need a global `pnpm` install.

## Setup

```bash
# First time (fresh clone) — bootstrap with npx if pnpm is not on PATH:
npx pnpm install

# Afterwards, or if node_modules already exists:
npm run install:deps
npm run rebuild-native     # optional: node-pty for local terminals
```

> If install scripts were skipped, run `npm run install:electron` to download the Electron binary.

## Development

```bash
npm run dev
```

`npm run dev` runs a full `electron-vite build` first, then starts the dev server — so the app always launches with the latest compiled main/preload/renderer bundles.

For hot-reload only (skip pre-build):

```bash
node scripts/pnpm.mjs --filter @consoleri/desktop dev:watch
```

If you have `pnpm` on PATH, `pnpm dev` works the same way.

## Build

```bash
npm run build
npm run package
```

## Test

```bash
npm run test
```

## Release

Prerequisites:

- [git-cliff](https://git-cliff.org/) in `PATH` (`scoop install git-cliff` on Windows)
- Git Bash or another `bash` shell (`bash` ships with Git for Windows)
- Clean working tree on `main` or `master`

```bash
# Preview the next version and changelog
npm run release -- --dry-run patch

# Bump version, update CHANGELOG.md, commit, and tag
npm run test
npm run release -- patch   # or minor | major

# Publish
git push origin main
git push origin vX.Y.Z
```

Release commits use the message `chore(release): vX.Y.Z` and are excluded from future changelogs.
Pass `--no-test` to skip the pre-release test run.
