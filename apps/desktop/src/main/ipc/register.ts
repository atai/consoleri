import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { HostFilter, HostInput, ProfileInput, WorkspaceState } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { credentialVault } from '../hosts/CredentialVault'
import { sessionManager } from '../sessions/SessionManager'
import { listWslDistros } from '../sessions/shellUtils'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.hostsList, (_e, filter: HostFilter) => {
    return hostRepository.listHosts(filter)
  })

  ipcMain.handle(IPC_CHANNELS.hostsGet, (_e, id: string) => {
    return hostRepository.getHost(id)
  })

  ipcMain.handle(IPC_CHANNELS.hostsCreate, (_e, input: HostInput) => {
    return hostRepository.createHost(input)
  })

  ipcMain.handle(IPC_CHANNELS.hostsUpdate, (_e, id: string, input: Partial<HostInput>) => {
    return hostRepository.updateHost(id, input)
  })

  ipcMain.handle(IPC_CHANNELS.hostsDelete, (_e, id: string) => {
    hostRepository.deleteHost(id)
  })

  ipcMain.handle(IPC_CHANNELS.hostsImport, (_e, items: HostInput[]) => {
    return hostRepository.importHosts(items)
  })

  ipcMain.handle(IPC_CHANNELS.groupsList, () => hostRepository.listGroups())

  ipcMain.handle(IPC_CHANNELS.groupsCreate, (_e, name: string, parentId?: string) => {
    return hostRepository.createGroup(name, parentId ?? null)
  })

  ipcMain.handle(IPC_CHANNELS.profilesList, (_e, hostId?: string) => {
    return hostRepository.listProfiles(hostId)
  })

  ipcMain.handle(IPC_CHANNELS.profilesCreate, (_e, input: ProfileInput) => {
    return hostRepository.createProfile(input)
  })

  ipcMain.handle(IPC_CHANNELS.profilesUpdate, (_e, id: string, input: Partial<ProfileInput>) => {
    return hostRepository.updateProfile(id, input)
  })

  ipcMain.handle(IPC_CHANNELS.profilesDelete, (_e, id: string) => {
    hostRepository.deleteProfile(id)
  })

  ipcMain.handle(IPC_CHANNELS.credentialsStore, (_e, ref: string, secret: string) => {
    return credentialVault.store(ref, secret)
  })

  ipcMain.handle(IPC_CHANNELS.credentialsDelete, (_e, ref: string) => {
    return credentialVault.delete(ref)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsOpen, async (_e, request, cols?: number, rows?: number) => {
    const win = getWindow()
    if (win) sessionManager.setWindow(win)
    return sessionManager.open(request, cols, rows)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsClose, (_e, sessionId: string) => {
    sessionManager.close(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsWrite, (_e, sessionId: string, data: string) => {
    sessionManager.write(sessionId, data)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsResize, (_e, sessionId: string, cols: number, rows: number) => {
    sessionManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsList, () => sessionManager.list())

  ipcMain.handle(IPC_CHANNELS.sessionsReconnect, (_e, sessionId: string) => {
    return sessionManager.reconnect(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsRdpCredentials, async (_e, profileId: string) => {
    return sessionManager.getCredentialsForRdp(profileId)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsVncPassword, async (_e, profileId: string) => {
    return sessionManager.getCredentialsForVnc(profileId)
  })

  ipcMain.handle(
    IPC_CHANNELS.sessionsSnapshot,
    (
      _e,
      snapshot: {
        id: string
        hostId: string | null
        profileId: string | null
        protocol: string
        title: string
        cwd: string | null
        cols: number
        rows: number
        scrollbackSerialized: string | null
      }
    ) => {
      hostRepository.saveSessionSnapshot(snapshot)
    }
  )

  ipcMain.handle(IPC_CHANNELS.wslList, () => listWslDistros())

  ipcMain.handle(IPC_CHANNELS.workspaceSave, (_e, state: WorkspaceState, name?: string) => {
    return hostRepository.saveWorkspace(state, name)
  })

  ipcMain.handle(IPC_CHANNELS.workspaceLoad, () => hostRepository.loadWorkspace())

  ipcMain.handle(IPC_CHANNELS.workspaceGetActive, () => hostRepository.getActiveWorkspace())
}
