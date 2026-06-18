import { BrowserWindow } from 'electron'
import type { ReportConfig, ReportProgressEvent, ReportResult, ReportType } from '@consoleri/core'
import { IPC_CHANNELS } from '../../shared/types'
import { connectivityProbe } from './ConnectivityProbe'
import { customTestProbe } from './CustomTestProbe'
import { inventoryProbe } from './InventoryProbe'
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

async function probeHost(
  type: ReportType,
  config: ReportConfig,
  hostId: string,
  profileId: string,
  onCommandProgress?: (commandIndex: number, commandTotal: number) => void
): Promise<ReportResult['entries'][number]> {
  switch (type) {
    case 'connectivity_test':
      return connectivityProbe.probe(hostId, profileId)
    case 'inventory':
      return inventoryProbe.probe(hostId, profileId)
    case 'custom_test':
      return customTestProbe.probe(hostId, profileId, {
        commands: config.commands,
        continueOnError: config.continueOnError,
        onCommandProgress
      })
    default:
      throw new Error(`Unsupported report type: ${type}`)
  }
}

export class ReportRunner {
  async run(reportId: string): Promise<ReportResult> {
    const report = reportRepository.get(reportId)
    if (!report) throw new Error(`Report not found: ${reportId}`)

    const entries = report.config.entries
    const runAt = new Date().toISOString()
    const results: ReportResult['entries'] = []

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!
      sendProgress(reportId, {
        reportId,
        index,
        total: entries.length,
        hostId: entry.hostId,
        status: 'running'
      })

      const hostResult = await probeHost(
        report.type,
        report.config,
        entry.hostId,
        entry.profileId,
        report.type === 'custom_test'
          ? (commandIndex, commandTotal) => {
              sendProgress(reportId, {
                reportId,
                index,
                total: entries.length,
                hostId: entry.hostId,
                status: 'running',
                commandIndex,
                commandTotal
              })
            }
          : undefined
      )
      results.push(hostResult)

      sendProgress(reportId, {
        reportId,
        index,
        total: entries.length,
        hostId: entry.hostId,
        status: hostResult.status
      })
    }

    const result = { type: report.type, runAt, entries: results } as ReportResult
    reportRepository.saveResult(reportId, result)
    broadcastReportUpdated(reportId)
    return result
  }
}

export const reportRunner = new ReportRunner()
