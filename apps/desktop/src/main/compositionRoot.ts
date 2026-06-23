/**
 * Composition root — the single place where all main-process singletons are
 * instantiated and wired together with explicit dependencies.
 *
 * Import from this module (rather than individual files) whenever you need
 * a fully-wired instance.  Individual files still export their own singletons
 * (created with their default constructor parameters) so that existing
 * vi.mock()-based tests continue to work without modification.
 *
 * Dependency order: leaf nodes first, composite nodes last.
 */

import { HostRepository } from './hosts/HostRepository'
import { ProfileRepository } from './hosts/ProfileRepository'
import { WorkspaceRepository } from './hosts/WorkspaceRepository'
import { HostImportExportService } from './hosts/HostImportExportService'
import { LocalSecretBackend } from './secrets/LocalSecretBackend'
import { HashicorpVaultBackend } from './secrets/HashicorpVaultBackend'
import { SecretBackendService } from './secrets/SecretBackendService'
import { VaultSettingsRepository } from './vault/VaultSettingsRepository'
import { CredentialResolver } from './services/CredentialResolver'
import { ConnectionLog } from './sessions/ConnectionLog'
import { UxProfileRepository } from './ux/UxProfileRepository'
import { SessionFactory } from './sessions/SessionFactory'
import { SessionManager } from './sessions/SessionManager'
import { AppPreferencesRepository } from './preferences/AppPreferencesRepository'

// ── Leaf singletons ────────────────────────────────────────────────────────────

export const hostRepository = new HostRepository()
export const profileRepository = new ProfileRepository()
export const workspaceRepository = new WorkspaceRepository()

export const localSecretBackend = new LocalSecretBackend()
export const hashicorpVaultBackend = new HashicorpVaultBackend()
export const secretBackendService = new SecretBackendService([
  localSecretBackend,
  hashicorpVaultBackend
])

export const vaultSettingsRepository = new VaultSettingsRepository()
export const connectionLog = new ConnectionLog()
export const uxProfileRepository = new UxProfileRepository()
export const appPreferencesRepository = new AppPreferencesRepository()

// ── Composite singletons ───────────────────────────────────────────────────────

export const credentialResolver = new CredentialResolver(
  secretBackendService,
  vaultSettingsRepository
)

export const sessionFactory = new SessionFactory(
  hostRepository,
  profileRepository,
  uxProfileRepository,
  credentialResolver,
  connectionLog
)

export const sessionManager = new SessionManager(
  hostRepository,
  profileRepository,
  credentialResolver,
  connectionLog,
  sessionFactory
)

export const hostImportExportService = new HostImportExportService(
  hostRepository,
  profileRepository
)
