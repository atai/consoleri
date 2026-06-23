import { ipcMain, clipboard } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/types'
import { createHandler } from './createHandler'
import { appPreferencesRepository } from '../preferences/AppPreferencesRepository'
import type { AppSettings, HostListViewSettings, MapViewSettings } from '../../shared/types'

export function registerPreferencesIpc(): void {
  // ── clipboard ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.clipboardReadText, () => clipboard.readText())

  ipcMain.handle(IPC_CHANNELS.clipboardWriteText,
    createHandler(z.string(), (text: string) => {
      clipboard.writeText(text)
      return Promise.resolve()
    })
  )

  // ── preferences ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.preferencesGetHostListView, () => {
    return appPreferencesRepository.getHostListView()
  })

  ipcMain.handle(
    IPC_CHANNELS.preferencesSetHostListView,
    (_e, patch: Partial<HostListViewSettings>) => {
      return appPreferencesRepository.setHostListView(patch)
    }
  )

  ipcMain.handle(IPC_CHANNELS.preferencesGetMapView, () => {
    return appPreferencesRepository.getMapView()
  })

  ipcMain.handle(IPC_CHANNELS.preferencesSetMapView, (_e, patch: Partial<MapViewSettings>) => {
    return appPreferencesRepository.setMapView(patch)
  })

  ipcMain.handle(IPC_CHANNELS.preferencesGetAppSettings, () => {
    return appPreferencesRepository.getAppSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.preferencesSetAppSettings,
    createHandler(
      z.object({ autoOpenConnectionLog: z.boolean().optional(), sessionOpenMode: z.enum(['workspace', 'window']).optional() }),
      (patch) => Promise.resolve(appPreferencesRepository.setAppSettings(patch as Partial<AppSettings>))
    )
  )
}
