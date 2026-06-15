import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { appIconPath } from '../appBranding'
import { reportRepository } from '../reports/ReportRepository'
import { registerReportWindow } from '../reports/ReportRunner'

const reportWindows = new Map<string, BrowserWindow>()

export function openReportWindow(
  reportId: string,
  parent: BrowserWindow | null
): BrowserWindow {
  const existing = reportWindows.get(reportId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return existing
  }

  const report = reportRepository.get(reportId)
  const title = report?.name ?? 'Report'

  const win = new BrowserWindow({
    width: 800,
    height: 560,
    minWidth: 480,
    minHeight: 320,
    title: `Report — ${title}`,
    icon: appIconPath(),
    backgroundColor: '#0d1117',
    parent: parent ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/report.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  reportWindows.set(reportId, win)
  registerReportWindow(reportId, win)

  win.on('closed', () => {
    reportWindows.delete(reportId)
  })

  const query = `?reportId=${encodeURIComponent(reportId)}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/report-window/index.html${query}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/report-window/index.html'), {
      query: { reportId }
    })
  }

  return win
}
