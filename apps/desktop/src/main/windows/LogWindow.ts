import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { appIconPath } from '../appBranding'
import { sessionManager } from '../sessions/SessionManager'
import { formatLogWindowTitle, pinBrowserWindowTitle, type LogWindowKind } from '../windowTitles'

const logWindows = new Map<string, BrowserWindow>()

export interface LogWindowContext {
  kind?: LogWindowKind
  hostId?: string
  profileId?: string
}

const logContexts = new Map<string, Required<Pick<LogWindowContext, 'kind'>> & LogWindowContext>()

export function registerLogContext(logId: string, context: LogWindowContext): void {
  logContexts.set(logId, {
    kind: context.kind ?? 'connection',
    hostId: context.hostId,
    profileId: context.profileId
  })
}

function resolveLogTitle(logId: string, explicit?: LogWindowContext): string {
  const kind = explicit?.kind ?? logContexts.get(logId)?.kind ?? 'connection'
  const hostId = explicit?.hostId ?? logContexts.get(logId)?.hostId
  const profileId = explicit?.profileId ?? logContexts.get(logId)?.profileId

  if (hostId || profileId) {
    return formatLogWindowTitle({ kind, hostId, profileId })
  }

  const session = sessionManager.list().find((s) => s.id === logId)
  if (session) {
    return formatLogWindowTitle({
      kind: 'connection',
      hostId: session.hostId,
      profileId: session.profileId,
      fallbackLabel: session.title
    })
  }

  return formatLogWindowTitle({ kind })
}

function buildLogQuery(logId: string, headerTitle: string): string {
  const params = new URLSearchParams({
    sessionId: logId,
    headerTitle
  })
  return `?${params.toString()}`
}

export function openLogWindow(
  logId: string,
  parent: BrowserWindow | null,
  context?: LogWindowContext
): BrowserWindow {
  if (context) {
    registerLogContext(logId, context)
  }

  const headerTitle = resolveLogTitle(logId, context)
  const query = buildLogQuery(logId, headerTitle)

  const existing = logWindows.get(logId)
  if (existing && !existing.isDestroyed()) {
    existing.setTitle(headerTitle)
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 640,
    height: 420,
    minWidth: 400,
    minHeight: 200,
    title: headerTitle,
    icon: appIconPath(),
    backgroundColor: '#0d1117',
    parent: parent ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/log.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  pinBrowserWindowTitle(win, () => resolveLogTitle(logId))

  logWindows.set(logId, win)
  sessionManager.setLogWindow(win)

  win.on('closed', () => {
    logWindows.delete(logId)
    if (sessionManager) sessionManager.setLogWindow(null)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/log-window/index.html${query}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/log-window/index.html'), {
      query: Object.fromEntries(new URLSearchParams(query.slice(1)))
    })
  }

  return win
}
