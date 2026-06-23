import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/types'
import type { UxProfileInput } from '../../shared/types'
import { Id, UxProfileInputSchema } from '../../shared/ipcSchemas'
import { createHandler } from './createHandler'
import { uxProfileRepository } from '../ux/UxProfileRepository'
import { migrateSidebarWidthFromRenderer } from '../db/database'

export function registerUxProfilesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.uxProfilesList, (_e, hostId?: string) => {
    return uxProfileRepository.list(hostId)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesGet,
    createHandler(Id, (id: string) =>
      Promise.resolve(uxProfileRepository.get(id))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesCreate,
    createHandler(UxProfileInputSchema, (input) =>
      Promise.resolve(uxProfileRepository.create(input as unknown as UxProfileInput))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesUpdate,
    createHandler(z.tuple([Id, UxProfileInputSchema.partial()]), ([id, input]) =>
      Promise.resolve(uxProfileRepository.update(id, input as unknown as Partial<UxProfileInput>))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesDelete,
    createHandler(Id, (id: string) => {
      uxProfileRepository.delete(id)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesDuplicate,
    createHandler(z.tuple([Id, z.string().optional()]), ([sourceId, name]: [string, string | undefined]) =>
      Promise.resolve(uxProfileRepository.duplicate(sourceId, name))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesGetActive, () => {
    return uxProfileRepository.getActive()
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesSetActive,
    createHandler(Id, (id: string) =>
      Promise.resolve(uxProfileRepository.setActive(id))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesListHosts,
    createHandler(Id, (profileId: string) =>
      Promise.resolve(uxProfileRepository.listHosts(profileId))
    )
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesMigrateSidebarWidth,
    createHandler(z.number().int().positive(), (width: number) => {
      migrateSidebarWidthFromRenderer(width)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesLinkHost,
    createHandler(z.tuple([Id, Id]), ([hostId, profileId]: [string, string]) => {
      uxProfileRepository.linkHost(hostId, profileId)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.uxProfilesUnlinkHost,
    createHandler(Id, (hostId: string) => {
      uxProfileRepository.unlinkHost(hostId)
      return Promise.resolve()
    })
  )
}
