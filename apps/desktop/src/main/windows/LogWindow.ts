import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { appIconPath } from '../appBranding'
import { sessionManager } from '../sessions/SessionManager'

const logWindows = new Map<string, BrowserWindow>()

export function openLogWindow(
  sessionId: string,
  parent: BrowserWindow | null,
  titlePrefix = 'Connection log'
): BrowserWindow {
  const existing = logWindows.get(sessionId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 640,
    height: 420,
    minWidth: 400,
    minHeight: 200,
    title: `${titlePrefix} — ${sessionId.slice(0, 8)}`,
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

  logWindows.set(sessionId, win)
  sessionManager.setLogWindow(win)

  win.on('closed', () => {
    logWindows.delete(sessionId)
    if (sessionManager) sessionManager.setLogWindow(null)
  })

  const query = `?sessionId=${encodeURIComponent(sessionId)}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/log-window/index.html${query}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/log-window/index.html'), {
      query: { sessionId }
    })
  }

  return win
}
