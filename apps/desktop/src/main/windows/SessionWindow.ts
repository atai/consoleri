import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { APP_NAME, appIconPath } from '../appBranding'
import { sessionManager } from '../sessions/SessionManager'
import { formatSessionWindowTitle, joinWindowTitle } from '../windowTitles'

const sessionWindows = new Map<string, BrowserWindow>()

export function getSessionWindow(sessionId: string): BrowserWindow | undefined {
  const win = sessionWindows.get(sessionId)
  if (win && !win.isDestroyed()) return win
  return undefined
}

export function openSessionWindow(
  sessionId: string,
  parent: BrowserWindow | null
): BrowserWindow {
  const existing = getSessionWindow(sessionId)
  const info = sessionManager.list().find((s) => s.id === sessionId)
  const title = info
    ? formatSessionWindowTitle(info)
    : joinWindowTitle('Session', APP_NAME)

  if (existing) {
    existing.setTitle(title)
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 400,
    minHeight: 300,
    title,
    icon: appIconPath(),
    backgroundColor: '#0f1117',
    parent: parent ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  sessionWindows.set(sessionId, win)
  sessionManager.registerSessionWindow(sessionId, win)

  win.on('closed', () => {
    sessionWindows.delete(sessionId)
    sessionManager.unregisterSessionWindow(sessionId)
    void sessionManager.close(sessionId)
  })

  const query = `?sessionId=${encodeURIComponent(sessionId)}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/session-window/index.html${query}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/session-window/index.html'), {
      query: { sessionId }
    })
  }

  return win
}

export function closeSessionWindow(sessionId: string): void {
  const win = sessionWindows.get(sessionId)
  if (!win || win.isDestroyed()) return
  win.removeAllListeners('closed')
  win.close()
  sessionWindows.delete(sessionId)
  sessionManager.unregisterSessionWindow(sessionId)
}
