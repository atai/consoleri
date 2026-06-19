import { ipcMain, clipboard, type BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { IPC_CHANNELS } from '../../shared/types'
import type { HostFilter, HostInput, ProfileInput, UxProfileInput, WorkspaceState, DeployKeyRequest, ReportInput } from '../../shared/types'
import { hostRepository } from '../hosts/HostRepository'
import { uxProfileRepository } from '../ux/UxProfileRepository'
import { credentialVault } from '../hosts/CredentialVault'
import { sessionManager } from '../sessions/SessionManager'
import { listWslDistros } from '../sessions/shellUtils'
import { openLogWindow, registerLogContext } from '../windows/LogWindow'
import { openReportWindow } from '../windows/ReportWindow'
import { openSessionWindow } from '../windows/SessionWindow'
import { sshKeyService } from '../keys/SshKeyService'
import { sshKeyDeployer } from '../keys/SshKeyDeployer'
import { migrateSidebarWidthFromRenderer } from '../db/database'
import { appPreferencesRepository } from '../preferences/AppPreferencesRepository'
import { reportRepository } from '../reports/ReportRepository'
import { reportRunner } from '../reports/ReportRunner'
import type { HostListViewSettings, MapViewSettings } from '@consoleri/core'

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

  ipcMain.handle(IPC_CHANNELS.hostsImport, (_e, payload: unknown) => {
    return hostRepository.importHosts(payload)
  })

  ipcMain.handle(IPC_CHANNELS.hostsExport, () => {
    return hostRepository.exportHostsBundle()
  })

  ipcMain.handle(IPC_CHANNELS.hostsExportToFile, () => {
    return hostRepository.exportHostsToFile()
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

  ipcMain.handle(IPC_CHANNELS.profilesLink, (_e, hostId: string, profileId: string) => {
    hostRepository.linkHostProfile(hostId, profileId)
  })

  ipcMain.handle(IPC_CHANNELS.profilesUnlink, (_e, hostId: string, profileId: string) => {
    hostRepository.unlinkHostProfile(hostId, profileId)
  })

  ipcMain.handle(IPC_CHANNELS.profilesListHosts, (_e, profileId: string) => {
    return hostRepository.listHostsForProfile(profileId)
  })

  ipcMain.handle(
    IPC_CHANNELS.profilesDuplicate,
    (_e, sourceId: string, targetHostId?: string, name?: string) => {
      return hostRepository.duplicateProfile(sourceId, targetHostId, name)
    }
  )

  ipcMain.handle(IPC_CHANNELS.credentialsStore, (_e, ref: string, secret: string) => {
    return credentialVault.store(ref, secret)
  })

  ipcMain.handle(IPC_CHANNELS.credentialsDelete, (_e, ref: string) => {
    return credentialVault.delete(ref)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsOpen, (_e, request, cols?: number, rows?: number) => {
    const win = getWindow()
    if (win) sessionManager.setWindow(win)
    return sessionManager.open(request, cols, rows)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsClose, (_e, sessionId: string) => {
    sessionManager.close(sessionId)
  })

  ipcMain.on(IPC_CHANNELS.sessionsWrite, (_e, sessionId: string, data: string) => {
    sessionManager.write(sessionId, data)
  })

  ipcMain.on(IPC_CHANNELS.sessionsResize, (_e, sessionId: string, cols: number, rows: number) => {
    sessionManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsList, () => sessionManager.list())

  ipcMain.handle(IPC_CHANNELS.sessionsReconnect, (_e, sessionId: string) => {
    return sessionManager.reconnect(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.sessionsGetConnectRequest, (_e, sessionId: string) => {
    return sessionManager.getConnectRequest(sessionId)
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

  ipcMain.handle(IPC_CHANNELS.sessionsLogGet, (_e, sessionId: string) => {
    return sessionManager.getLogEntries(sessionId)
  })

  ipcMain.handle(
    IPC_CHANNELS.sessionsLogAppend,
    (_e, sessionId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string) => {
      sessionManager.appendSessionLog(sessionId, level, message)
    }
  )

  ipcMain.handle(IPC_CHANNELS.sessionsLogOpenWindow, (_e, sessionId: string) => {
    openLogWindow(sessionId, getWindow())
  })

  ipcMain.handle(IPC_CHANNELS.sessionsOpenSessionWindow, (_e, sessionId: string) => {
    openSessionWindow(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.workspaceGetActive, () => hostRepository.getActiveWorkspace())

  ipcMain.handle(IPC_CHANNELS.keysList, () => sshKeyService.listKeys())

  ipcMain.handle(IPC_CHANNELS.keysAdd, (_e, path: string, label?: string) => {
    return sshKeyService.addCustomKey(path, label)
  })

  ipcMain.handle(IPC_CHANNELS.keysRemove, (_e, id: string) => {
    sshKeyService.removeCustomKey(id)
  })

  ipcMain.handle(IPC_CHANNELS.keysPickFile, () => sshKeyService.pickKeyFile())

  ipcMain.handle(IPC_CHANNELS.keysAssign, async (_e, profileId: string, keyPath: string) => {
    await sshKeyService.assignToProfile(profileId, keyPath)
  })

  ipcMain.handle(IPC_CHANNELS.keysDeploy, async (_e, request: DeployKeyRequest) => {
    const logId = request.logId ?? nanoid()
    registerLogContext(logId, {
      kind: 'deploy',
      hostId: request.hostId,
      profileId: request.profileId
    })
    if (request.openLog) {
      openLogWindow(logId, getWindow(), {
        kind: 'deploy',
        hostId: request.hostId,
        profileId: request.profileId
      })
    }
    const result = await sshKeyDeployer.deploy({ ...request, logId })
    return { ...result, logId }
  })

  ipcMain.handle(IPC_CHANNELS.keysStorePassphrase, async (_e, keyPath: string, passphrase: string) => {
    await sshKeyService.storePassphrase(keyPath, passphrase)
  })

  ipcMain.handle(IPC_CHANNELS.keysAssignableHosts, () => sshKeyService.listAssignableHosts())

  ipcMain.handle(IPC_CHANNELS.uxProfilesList, (_e, hostId?: string) => {
    return uxProfileRepository.list(hostId)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesGet, (_e, id: string) => {
    return uxProfileRepository.get(id)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesCreate, (_e, input: UxProfileInput) => {
    return uxProfileRepository.create(input)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesUpdate, (_e, id: string, input: Partial<UxProfileInput>) => {
    return uxProfileRepository.update(id, input)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesDelete, (_e, id: string) => {
    uxProfileRepository.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesDuplicate, (_e, sourceId: string, name?: string) => {
    return uxProfileRepository.duplicate(sourceId, name)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesGetActive, () => {
    return uxProfileRepository.getActive()
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesSetActive, (_e, id: string) => {
    return uxProfileRepository.setActive(id)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesListHosts, (_e, profileId: string) => {
    return uxProfileRepository.listHosts(profileId)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesMigrateSidebarWidth, (_e, width: number) => {
    migrateSidebarWidthFromRenderer(width)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesLinkHost, (_e, hostId: string, profileId: string) => {
    uxProfileRepository.linkHost(hostId, profileId)
  })

  ipcMain.handle(IPC_CHANNELS.uxProfilesUnlinkHost, (_e, hostId: string) => {
    uxProfileRepository.unlinkHost(hostId)
  })

  ipcMain.handle(IPC_CHANNELS.clipboardReadText, () => clipboard.readText())

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

  ipcMain.handle(IPC_CHANNELS.clipboardWriteText, (_e, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC_CHANNELS.reportsList, () => reportRepository.list())

  ipcMain.handle(IPC_CHANNELS.reportsGet, (_e, id: string) => reportRepository.get(id))

  ipcMain.handle(IPC_CHANNELS.reportsCreate, (_e, input: ReportInput) =>
    reportRepository.create(input)
  )

  ipcMain.handle(IPC_CHANNELS.reportsUpdate, (_e, id: string, patch: Partial<ReportInput>) =>
    reportRepository.update(id, patch)
  )

  ipcMain.handle(IPC_CHANNELS.reportsDelete, (_e, id: string) => {
    reportRepository.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.reportsRun, (_e, reportId: string) => reportRunner.run(reportId))

  ipcMain.handle(IPC_CHANNELS.reportsOpenWindow, (_e, reportId: string) => {
    openReportWindow(reportId, getWindow())
  })
}
