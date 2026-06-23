import { HostImportExportService } from './HostImportExportService'
import { hostRepository } from './HostRepository'
import { profileRepository } from './ProfileRepository'

export const hostImportExportService = new HostImportExportService(hostRepository, profileRepository)
