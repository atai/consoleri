import { BrowserWindow } from 'electron'
import type { ConnectivityTestResult, ReportProgressEvent } from '@consoleri/core'
import { IPC_CHANNELS } from '../../shared/types'
import { connectivityProbe } from './ConnectivityProbe'
import { reportRepository } from './ReportRepository'

const reportWindows = new Map<string, BrowserWindow>()

export function registerReportWindow(reportId: string, win: BrowserWindow): void {
  reportWindows.set(reportId, win)
  win.on('closed', () => {
    reportWindows.delete(reportId)
  })
}

function sendProgress(reportId: string, event: ReportProgressEvent): void {
  const win = reportWindows.get(reportId)
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.reportProgress, event)
  }
}

function broadcastReportUpdated(reportId: string): void {
  const report = reportRepository.get(reportId)
  if (!report) return
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.reportUpdated, report)
    }
  }
}

export class ReportRunner {
  async run(reportId: string): Promise<ConnectivityTestResult> {
    const report = reportRepository.get(reportId)
    if (!report) throw new Error(`Report not found: ${reportId}`)
    if (report.config.type !== 'connectivity_test') {
      throw new Error(`Unsupported report type: ${report.type}`)
    }

    const entries = report.config.entries
    const runAt = new Date().toISOString()
    const results: ConnectivityTestResult['entries'] = []

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!
      sendProgress(reportId, {
        reportId,
        index,
        total: entries.length,
        hostId: entry.hostId,
        status: 'running'
      })

      const hostResult = await connectivityProbe.probe(entry.hostId, entry.profileId)
      results.push(hostResult)

      sendProgress(reportId, {
        reportId,
        index,
        total: entries.length,
        hostId: entry.hostId,
        status: hostResult.status
      })
    }

    const result: ConnectivityTestResult = { runAt, entries: results }
    reportRepository.saveResult(reportId, result)
    broadcastReportUpdated(reportId)
    return result
  }
}

export const reportRunner = new ReportRunner()
