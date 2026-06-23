import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { APP_NAME, appIconPath } from '../appBranding'
import { sessionManager } from '../sessions/SessionManager'
import { formatSessionWindowTitle, joinWindowTitle, pinBrowserWindowTitle } from '../windowTitles'
import {
  registerSessionWindow,
  unregisterSessionWindow,
  getRegisteredSessionWindow
} from './SessionWindowRegistry'

export { getRegisteredSessionWindow as getSessionWindow }

export function openSessionWindow(sessionId: string): BrowserWindow {
  const existing = getRegisteredSessionWindow(sessionId)
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  pinBrowserWindowTitle(win, () => {
    const session = sessionManager.list().find((s) => s.id === sessionId)
    return session ? formatSessionWindowTitle(session) : joinWindowTitle('Session', APP_NAME)
  })

  registerSessionWindow(sessionId, win)

  win.on('closed', () => {
    unregisterSessionWindow(sessionId)
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
  const win = getRegisteredSessionWindow(sessionId)
  if (!win) return
  win.removeAllListeners('closed')
  win.close()
  unregisterSessionWindow(sessionId)
}
