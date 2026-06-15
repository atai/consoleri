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
