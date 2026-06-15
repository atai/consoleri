# Инструкция для агента (ветка main, сессия рефакторинга)

Краткий контекст для продолжения работы над **Consoleri** — Electron-приложение для SSH/shell/RDP/VNC с инвентарём хостов и mosaic-workspace.

## Структура monorepo

```
consoleri/
├── apps/desktop/          @consoleri/desktop — Electron + React
├── packages/core/         @consoleri/core — pure-функции + Vitest
├── scripts/               dev.mjs, pnpm.mjs, postinstall, rebuild-native
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

**Менеджер пакетов:** pnpm (локально в `devDependencies`, глобальный не обязателен).

## Запуск и проверки

```bash
# Первый раз после клона
npx pnpm install

# Дальше — без pnpm в PATH
npm run dev          # build:app → electron-vite dev
npm run build        # typecheck + production build
npm run test         # Vitest в @consoleri/core
```

`npm run dev` всегда делает предсборку (`electron-vite build`), чтобы main/preload/renderer были актуальны.

Hot-reload без предсборки: `node scripts/pnpm.mjs --filter @consoleri/desktop dev:watch`

## Что сделано в этой ветке

### 1. `packages/core` + тесты
Pure-функции вынесены из desktop:
- `workspace/layout` — `insertPaneIntoLayout`, `removeFromLayout` (бинарное mosaic-дерево)
- `protocols` — `isTerminalProtocol`, `defaultPortForProtocol`
- `hosts/mappers`, `credentials/resolveAuth`, `shell/*`

18 unit-тестов, `npm run test`.

### 2. Main process (SOLID)
| Модуль | Роль |
|--------|------|
| `CredentialResolver` | credentials из vault по profile |
| `SessionFactory` | transport по protocol |
| `ConnectionLog` | ring buffer логов per sessionId |
| `SessionManager` | async open, reconnect с тем же id, IPC push |
| `SshSession` | принимает готовый profile+credentials, без repo |
| `LogWindow` | отдельное окно лога подключения |

**SSH-фиксы:** правильный `profileId`, jump host ищет SSH-профиль, без fallback на PowerShell.

**Async open:** `sessions.open` сразу возвращает `{ status: 'connecting' }`, handshake в фоне.

### 3. Workspace / UI
- Загрузка workspace **один раз** в `App.tsx` (устранён race с `addSessionToWorkspace`)
- Вставка pane через `insertPaneIntoLayout` из core (3+ вкладки)
- Failed-сессии не добавляются в mosaic
- `ResizableSidebar` — drag resize, persist в localStorage
- `HostBrowser` — scroll (`min-h-0`, `flex-1 overflow-y-auto`)
- Connection log: кнопка **Log** в toolbar pane + отдельное окно (`log-window/`)
- Хосты: `HostListItem` с **Edit/Delete** на строке (hover / selected), `HostDetailPanel` внизу
- UI-kit: `components/ui/` — `Button`, `InlineConfirmButton`, `ConfirmDeleteButton`, `EditDeleteActions`

### 4. pnpm
- `package-lock.json` удалён, `pnpm-lock.yaml` добавлен
- `.npmrc`: `node-linker=hoisted` (Electron + native)
- `scripts/pnpm.mjs` — вызов локального pnpm без PATH
- Root-скрипты через `node scripts/pnpm.mjs`, не `pnpm` напрямую

## Важные gotchas

1. **`@consoleri/core` в main process** — должен **бандлиться**, не externalize. В `electron.vite.config.ts`:
   - `externalizeDepsPlugin({ exclude: ['@consoleri/core'] })`
   - alias на `packages/core/src`
   Иначе runtime: `ERR_MODULE_NOT_FOUND` для `./types` без `.js`.

2. **MosaicNode types** — react-mosaic и core типы несовместимы; при вызове core-хелперов кастить `as CoreMosaicNode`, результат — `as MosaicNode`.

3. **Terminal connect status** — после `attachTransport` обязательно `updateStatus(id, 'connected')`, иначе UI зависает на «Connecting…».

4. **pnpm не в PATH** — использовать `npm run *` или `node scripts/pnpm.mjs`.

5. **Electron binary** — `postinstall.mjs` скачивает при отсутствии; при `--ignore-scripts` → `npm run install:electron`.

## Ключевые файлы

```
packages/core/src/
apps/desktop/src/main/sessions/{SessionManager,SessionFactory,SshSession,ConnectionLog}.ts
apps/desktop/src/main/services/CredentialResolver.ts
apps/desktop/src/main/windows/LogWindow.ts
apps/desktop/src/renderer/src/components/
  hosts/{HostBrowser,HostListItem,HostDetailPanel,HostForm}.tsx
  workspace/MosaicWorkspace.tsx
  layout/ResizableSidebar.tsx
  ui/{Button,InlineConfirmButton,ConfirmDeleteButton,EditDeleteActions}.tsx
apps/desktop/src/renderer/log-window/
apps/desktop/electron.vite.config.ts
scripts/{dev,pnpm,postinstall,rebuild-native}.mjs
```

## Что не трогать без необходимости

- План рефакторинга в `.cursor/plans/` — read-only для агента
- Не коммитить без явной просьбы пользователя
- Не возвращать npm workspaces / `package-lock.json`

## Возможные следующие шаги

- Редактирование connection profiles (сейчас `HostForm` edit — только host fields)
- E2E / интеграционные тесты desktop
- Profile picker при connect без профиля — понятная ошибка в UI
- `HostForm` DRY: `defaultPortForProtocol` уже из core
