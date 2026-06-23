import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDataDir } from './paths'
import { APP_NAME, appIconPath } from './appBranding'
import { getDatabase, closeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/register'
import { sessionManager } from './compositionRoot'

// Must be called before app.whenReady() and before any call to app.getPath('userData').
// This redirects ALL Electron storage (SQLite, localStorage, IndexedDB, cookies)
// to our custom data directory so dev and packaged builds never share state.
app.setPath('userData', getDataDir())

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: appIconPath(),
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  sessionManager.setWindow(mainWindow)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.consoleri.desktop')
  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIconPath())
  }
  getDatabase()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(() => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  sessionManager.closeAll()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
