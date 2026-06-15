# Consoleri

Monorepo for Consoleri — a desktop host console manager (SSH, shells, RDP, VNC).

## Structure

- `apps/desktop` — Electron application (`@consoleri/desktop`)
- `packages/` — shared libraries (future)
- `scripts/` — root tooling (native rebuild, etc.)

## Development

```bash
npm install --ignore-scripts
npm run install:electron   # only if postinstall was skipped
npm run rebuild-native     # optional: node-pty for local terminals
npm run dev
```

> **Note:** `npm install --ignore-scripts` skips all postinstall hooks. Either run `npm run install:electron` manually, or use plain `npm install` (runs `postinstall`, which downloads Electron if missing).

## Build

```bash
npm run build
npm run package
```
