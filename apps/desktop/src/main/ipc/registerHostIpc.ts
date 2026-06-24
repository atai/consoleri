import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/types'
import type { HostFilter, HostInput, ProfileInput } from '../../shared/types'
import {
  Id,
  OptionalId,
  HostFilterSchema,
  HostInputSchema,
  ProfileInputSchema,
  CredentialRefSchema
} from '../../shared/ipcSchemas'
import { createHandler } from './createHandler'
import { hostRepository } from '../hosts/HostRepository'
import { profileRepository } from '../hosts/ProfileRepository'
import { hostImportExportService } from '../hosts/hostImportExportServiceInstance'
import { secretBackendService } from '../secrets/SecretBackendService'

export function registerHostIpc(): void {
  // ── hosts ──────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.hostsList,
    createHandler(HostFilterSchema, (filter: HostFilter) =>
      Promise.resolve(hostRepository.listHosts(filter))
    )
  )

  ipcMain.handle(IPC_CHANNELS.hostsGet,
    createHandler(Id, (id: string) =>
      Promise.resolve(hostRepository.getHost(id))
    )
  )

  ipcMain.handle(IPC_CHANNELS.hostsCreate,
    createHandler(HostInputSchema, (input: HostInput) =>
      Promise.resolve(hostRepository.createHost(input))
    )
  )

  ipcMain.handle(IPC_CHANNELS.hostsUpdate,
    createHandler(z.tuple([Id, HostInputSchema.partial()]), ([id, input]: [string, Partial<HostInput>]) =>
      Promise.resolve(hostRepository.updateHost(id, input))
    )
  )

  ipcMain.handle(IPC_CHANNELS.hostsDelete,
    createHandler(Id, (id: string) => {
      hostRepository.deleteHost(id)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.hostsImport, (_e, payload: unknown) => {
    return hostImportExportService.importHosts(payload)
  })

  ipcMain.handle(IPC_CHANNELS.hostsImportFromFile, () => {
    return hostImportExportService.importHostsFromFile()
  })

  ipcMain.handle(IPC_CHANNELS.hostsExport, () => {
    return hostImportExportService.exportHostsBundle()
  })

  ipcMain.handle(IPC_CHANNELS.hostsExportToFile, () => {
    return hostImportExportService.exportHostsToFile()
  })

  // ── groups ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.groupsList, () => hostRepository.listGroups())

  ipcMain.handle(IPC_CHANNELS.groupsCreate,
    createHandler(z.tuple([z.string().min(1), z.string().nullable().optional()]), ([name, parentId]) =>
      Promise.resolve(hostRepository.createGroup(name, parentId ?? null))
    )
  )

  // ── profiles ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.profilesList, (_e, hostId?: string) => {
    return profileRepository.listProfiles(hostId)
  })

  ipcMain.handle(IPC_CHANNELS.profilesCreate,
    createHandler(ProfileInputSchema, (input: ProfileInput) =>
      profileRepository.createProfile(input)
    )
  )

  ipcMain.handle(IPC_CHANNELS.profilesUpdate,
    createHandler(z.tuple([Id, ProfileInputSchema.partial()]), ([id, input]: [string, Partial<ProfileInput>]) =>
      profileRepository.updateProfile(id, input)
    )
  )

  ipcMain.handle(IPC_CHANNELS.profilesDelete,
    createHandler(Id, (id: string) =>
      profileRepository.deleteProfile(id)
    )
  )

  ipcMain.handle(IPC_CHANNELS.profilesLink,
    createHandler(z.tuple([Id, Id]), ([hostId, profileId]: [string, string]) => {
      profileRepository.linkHostProfile(hostId, profileId)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.profilesUnlink,
    createHandler(z.tuple([Id, Id]), ([hostId, profileId]: [string, string]) => {
      profileRepository.unlinkHostProfile(hostId, profileId)
      return Promise.resolve()
    })
  )

  ipcMain.handle(IPC_CHANNELS.profilesListHosts,
    createHandler(Id, (profileId: string) =>
      Promise.resolve(profileRepository.listHostsForProfile(profileId))
    )
  )

  ipcMain.handle(IPC_CHANNELS.profilesDuplicate,
    createHandler(
      z.tuple([Id, OptionalId, z.string().optional()]),
      ([sourceId, targetHostId, name]: [string, string | undefined, string | undefined]) =>
        profileRepository.duplicateProfile(sourceId, targetHostId, name)
    )
  )

  // ── credentials (security-gated) ──────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.credentialsStore,
    createHandler(
      z.tuple([CredentialRefSchema, z.string()]),
      ([ref, secret]: [string, string]) =>
        Promise.resolve(secretBackendService.store(ref, secret))
    )
  )

  ipcMain.handle(IPC_CHANNELS.credentialsDelete,
    createHandler(CredentialRefSchema, (ref: string) =>
      Promise.resolve(secretBackendService.delete(ref))
    )
  )
}
