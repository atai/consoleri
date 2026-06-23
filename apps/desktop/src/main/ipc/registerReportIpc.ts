import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { ReportInput } from '../../shared/types'
import { Id, ReportInputSchema } from '../../shared/ipcSchemas'
import { z } from 'zod'
import { createHandler } from './createHandler'
import { reportRepository } from '../reports/ReportRepository'
import { reportRunner } from '../reports/ReportRunner'
import { openReportWindow } from '../windows/ReportWindow'

export function registerReportIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.reportsList, () => reportRepository.list())

  ipcMain.handle(IPC_CHANNELS.reportsGet,
    createHandler(Id, (id: string) =>
      Promise.resolve(reportRepository.get(id))
    )
  )

  ipcMain.handle(IPC_CHANNELS.reportsCreate,
    createHandler(ReportInputSchema, (input) =>
      Promise.resolve(reportRepository.create(input as unknown as ReportInput))
    )
  )

  ipcMain.handle(IPC_CHANNELS.reportsUpdate,
    createHandler(z.tuple([Id, ReportInputSchema.partial()]), ([id, patch]) =>
      Promise.resolve(reportRepository.update(id, patch as unknown as Partial<ReportInput>))
    )
  )

  ipcMain.handle(IPC_CHANNELS.reportsDelete,
    createHandler(Id, (id: string) => {
      reportRepository.delete(id)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.reportsRun,
    createHandler(Id, (reportId: string) =>
      reportRunner.run(reportId)
    )
  )

  ipcMain.handle(IPC_CHANNELS.reportsOpenWindow,
    createHandler(Id, (reportId: string) => {
      openReportWindow(reportId, getWindow())
      return Promise.resolve()
    })
  )
}
