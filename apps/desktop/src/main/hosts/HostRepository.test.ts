import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { setDatabaseForTest, resetDatabaseForTest } from '../db/database'

// ── Electron stubs ──────────────────────────────────────────────────────────
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-consoleri'
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString()
  }
}))

// ── Credential / vault stubs ────────────────────────────────────────────────
const secretStore = new Map<string, string>()

vi.mock('../secrets/SecretBackendService', () => ({
  secretBackendService: {
    store: vi.fn(async (ref: string, secret: string) => {
      secretStore.set(ref, secret)
    }),
    retrieve: vi.fn(async (ref: string) => secretStore.get(ref) ?? null),
    delete: vi.fn(async (ref: string) => {
      secretStore.delete(ref)
    })
  }
}))

vi.mock('../vault/VaultSettingsRepository', () => ({
  vaultSettingsRepository: {
    getSettings: () => ({ defaultKvMount: 'secret', secretPathPrefix: 'consoleri/profiles' }),
    getDefaultBackend: () => 'local' as const
  }
}))

vi.mock('../logging/OperationLog', () => ({
  beginOperationLog: () => ({
    logId: 'test-log',
    log: vi.fn(),
    fail: (message: string) => {
      throw new Error(message)
    }
  })
}))

vi.mock('../ux/UxProfileRepository', () => ({
  uxProfileRepository: {
    list: vi.fn(() => [])
  }
}))

// ── Test setup ──────────────────────────────────────────────────────────────
import { HostRepository } from './HostRepository'
import { ProfileRepository } from './ProfileRepository'
import { WorkspaceRepository } from './WorkspaceRepository'
import { HostImportExportService } from './HostImportExportService'
import { getDatabase } from '../db/database'

let repo: HostRepository
let profileRepo: ProfileRepository
let workspaceRepo: WorkspaceRepository
let importExportService: HostImportExportService

beforeEach(() => {
  setDatabaseForTest(':memory:')
  secretStore.clear()
  repo = new HostRepository()
  profileRepo = new ProfileRepository()
  workspaceRepo = new WorkspaceRepository()
  importExportService = new HostImportExportService(repo, profileRepo)
})

afterEach(() => {
  resetDatabaseForTest()
})

// ── CRUD: hosts ─────────────────────────────────────────────────────────────
describe('createHost / getHost / updateHost / deleteHost', () => {
  it('creates and retrieves a host', () => {
    const host = repo.createHost({ name: 'web01', hostname: '10.0.0.1' })
    expect(host.id).toBeTruthy()
    expect(host.name).toBe('web01')
    expect(host.hostname).toBe('10.0.0.1')
    expect(host.port).toBe(22)
    expect(host.tags).toEqual([])
    expect(host.osType).toBe('unknown')

    const fetched = repo.getHost(host.id)
    expect(fetched).toEqual(host)
  })

  it('returns null for unknown id', () => {
    expect(repo.getHost('nonexistent')).toBeNull()
  })

  it('updates a host', () => {
    const host = repo.createHost({ name: 'web01', hostname: '10.0.0.1', port: 22 })
    const updated = repo.updateHost(host.id, { name: 'web01-updated', port: 2222 })
    expect(updated.name).toBe('web01-updated')
    expect(updated.port).toBe(2222)
    expect(updated.hostname).toBe('10.0.0.1')
  })

  it('throws when updating non-existent host', () => {
    expect(() => repo.updateHost('ghost', { name: 'x' })).toThrow('Host not found: ghost')
  })

  it('deletes a host', () => {
    const host = repo.createHost({ name: 'web01', hostname: '10.0.0.1' })
    repo.deleteHost(host.id)
    expect(repo.getHost(host.id)).toBeNull()
  })

  it('stores and preserves optional fields', () => {
    const host = repo.createHost({
      name: 'db',
      hostname: '192.168.1.5',
      port: 5432,
      osType: 'linux',
      tags: ['db', 'prod'],
      notes: 'main database',
      logVerbosity: 'verbose'
    })
    expect(host.osType).toBe('linux')
    expect(host.tags).toEqual(['db', 'prod'])
    expect(host.notes).toBe('main database')
    expect(host.logVerbosity).toBe('verbose')
  })
})

// ── listHosts: filter branches ───────────────────────────────────────────────
describe('listHosts filters', () => {
  beforeEach(() => {
    repo.createHost({ name: 'alpha', hostname: 'alpha.local', notes: 'first host' })
    repo.createHost({ name: 'beta', hostname: 'beta.example.com', tags: ['web'] })
    repo.createHost({ name: 'gamma', hostname: 'gamma.local', tags: ['web', 'prod'] })
  })

  it('returns all hosts without filters', () => {
    expect(repo.listHosts()).toHaveLength(3)
  })

  it('filters by search matching name', () => {
    const results = repo.listHosts({ search: 'alph' })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('alpha')
  })

  it('filters by search matching hostname', () => {
    const results = repo.listHosts({ search: 'example.com' })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('beta')
  })

  it('filters by search matching notes', () => {
    const results = repo.listHosts({ search: 'first host' })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('alpha')
  })

  it('filters by single tag (every-match)', () => {
    const results = repo.listHosts({ tags: ['web'] })
    expect(results).toHaveLength(2)
  })

  it('filters by multiple tags requiring all to match', () => {
    const results = repo.listHosts({ tags: ['web', 'prod'] })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('gamma')
  })

  it('returns empty when no tag match', () => {
    expect(repo.listHosts({ tags: ['nonexistent'] })).toHaveLength(0)
  })

  it('filters by groupId returning hosts in that group', () => {
    const group = repo.createGroup('infra')
    repo.createHost({ name: 'infra01', hostname: 'infra01.local', groupId: group.id })
    const results = repo.listHosts({ groupId: group.id })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('infra01')
  })

  it('filters by groupId null returning ungrouped hosts', () => {
    const group = repo.createGroup('infra')
    repo.createHost({ name: 'infra01', hostname: 'infra01.local', groupId: group.id })
    const ungrouped = repo.listHosts({ groupId: null })
    expect(ungrouped.every((h) => h.groupId === null)).toBe(true)
    expect(ungrouped.some((h) => h.name === 'infra01')).toBe(false)
  })
})

// ── Groups ───────────────────────────────────────────────────────────────────
describe('groups CRUD', () => {
  it('creates and lists groups', () => {
    const g = repo.createGroup('web', null, 10)
    const list = repo.listGroups()
    expect(list.some((x) => x.id === g.id)).toBe(true)
    expect(list.find((x) => x.id === g.id)?.sortOrder).toBe(10)
  })

  it('supports nested groups via parentId', () => {
    const parent = repo.createGroup('infra')
    const child = repo.createGroup('db', parent.id)
    expect(child.parentId).toBe(parent.id)
  })
})

// ── Profiles: secret orchestration ──────────────────────────────────────────
describe('createProfile secret orchestration', () => {
  it('stores password and records credentialRef', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-pass',
      protocol: 'ssh',
      username: 'root',
      password: 'hunter2'
    })
    expect(profile.credentialRef).toMatch(/^profile:/)
    expect(secretStore.get(profile.credentialRef!)).toBe('hunter2')
  })

  it('stores private key and records credentialRef', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-key',
      protocol: 'ssh',
      username: 'admin',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----'
    })
    expect(profile.credentialRef).toMatch(/profile:.*:key/)
    expect(secretStore.get(profile.credentialRef!)).toContain('OPENSSH')
  })

  it('creates profile without credentials when none provided', async () => {
    const profile = await profileRepo.createProfile({ name: 'no-creds', protocol: 'ssh', username: 'u' })
    expect(profile.credentialRef).toBeNull()
    expect(secretStore.size).toBe(0)
  })

  it('uses provided credentialRef when no password/privateKey given', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-ref',
      protocol: 'ssh',
      credentialRef: 'profile:existing-id:password'
    })
    expect(profile.credentialRef).toBe('profile:existing-id:password')
  })
})

describe('updateProfile secret orchestration', () => {
  it('replaces credential on password change (same ref, new secret)', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-pass',
      protocol: 'ssh',
      password: 'old-pass'
    })
    // updateProfile deletes old then re-stores under the same ref pattern
    const updated = await profileRepo.updateProfile(profile.id, { password: 'new-pass' })
    expect(updated.credentialRef).toBeTruthy()
    expect(secretStore.get(updated.credentialRef!)).toBe('new-pass')
  })

  it('preserves credentialRef when no new credential provided', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-pass',
      protocol: 'ssh',
      password: 'pass'
    })
    const ref = profile.credentialRef!
    const updated = await profileRepo.updateProfile(profile.id, { username: 'newuser' })
    expect(updated.credentialRef).toBe(ref)
    expect(updated.username).toBe('newuser')
  })
})

describe('cloneFromProfileId', () => {
  it('copies credential to new ref when cloning', async () => {
    const source = await profileRepo.createProfile({
      name: 'source',
      protocol: 'ssh',
      password: 'secret123'
    })
    secretStore.set(source.credentialRef!, 'secret123')

    const cloned = await profileRepo.createProfile({
      name: 'clone',
      protocol: 'ssh',
      cloneFromProfileId: source.id
    })
    expect(cloned.credentialRef).not.toBe(source.credentialRef)
    expect(cloned.credentialRef).toBeTruthy()
    // secret copied under the new ref
    expect(secretStore.get(cloned.credentialRef!)).toBe('secret123')
  })
})

describe('deleteProfile', () => {
  it('removes profile and cleans up credential', async () => {
    const profile = await profileRepo.createProfile({
      name: 'ssh-pass',
      protocol: 'ssh',
      password: 'pass'
    })
    const ref = profile.credentialRef!
    secretStore.set(ref, 'pass')

    await profileRepo.deleteProfile(profile.id)
    expect(profileRepo.getProfile(profile.id)).toBeNull()
    expect(secretStore.has(ref)).toBe(false)
  })
})

describe('duplicateProfile', () => {
  it('creates a copy with a distinct id and credentialRef', async () => {
    const source = await profileRepo.createProfile({
      name: 'original',
      protocol: 'ssh',
      password: 'pw'
    })
    secretStore.set(source.credentialRef!, 'pw')

    const dup = await profileRepo.duplicateProfile(source.id, undefined, 'copy')
    expect(dup.id).not.toBe(source.id)
    expect(dup.name).toBe('copy')
    expect(dup.credentialRef).not.toBe(source.credentialRef)
    expect(secretStore.get(dup.credentialRef!)).toBe('pw')
  })
})

// ── Host-profile links ───────────────────────────────────────────────────────
describe('host-profile links', () => {
  it('links and checks link exists', async () => {
    const host = repo.createHost({ name: 'h1', hostname: 'h1.local' })
    const profile = await profileRepo.createProfile({ name: 'p1', protocol: 'ssh' })

    profileRepo.linkHostProfile(host.id, profile.id)
    expect(profileRepo.isProfileLinkedToHost(host.id, profile.id)).toBe(true)
  })

  it('unlinks host-profile', async () => {
    const host = repo.createHost({ name: 'h1', hostname: 'h1.local' })
    const profile = await profileRepo.createProfile({ name: 'p1', protocol: 'ssh' })

    profileRepo.linkHostProfile(host.id, profile.id)
    profileRepo.unlinkHostProfile(host.id, profile.id)
    expect(profileRepo.isProfileLinkedToHost(host.id, profile.id)).toBe(false)
  })

  it('listProfiles returns profiles linked to a host', async () => {
    const host = repo.createHost({ name: 'h1', hostname: 'h1.local' })
    const p1 = await profileRepo.createProfile({ name: 'p1', protocol: 'ssh' })
    const p2 = await profileRepo.createProfile({ name: 'p2', protocol: 'rdp' })
    profileRepo.linkHostProfile(host.id, p1.id)
    profileRepo.linkHostProfile(host.id, p2.id)

    const profiles = profileRepo.listProfiles(host.id)
    expect(profiles).toHaveLength(2)
    expect(profiles.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort())
  })

  it('listHostsForProfile returns hosts linked to a profile', async () => {
    const h1 = repo.createHost({ name: 'h1', hostname: 'h1.local' })
    const h2 = repo.createHost({ name: 'h2', hostname: 'h2.local' })
    const p = await profileRepo.createProfile({ name: 'p', protocol: 'ssh' })
    profileRepo.linkHostProfile(h1.id, p.id)
    profileRepo.linkHostProfile(h2.id, p.id)

    const hosts = profileRepo.listHostsForProfile(p.id)
    expect(hosts).toHaveLength(2)
    expect(hosts.map((h) => h.id).sort()).toEqual([h1.id, h2.id].sort())
  })

  it('throws when linking non-existent host', async () => {
    const p = await profileRepo.createProfile({ name: 'p', protocol: 'ssh' })
    expect(() => profileRepo.linkHostProfile('ghost', p.id)).toThrow('Host not found: ghost')
  })

  it('throws when linking non-existent profile', () => {
    const h = repo.createHost({ name: 'h', hostname: 'h.local' })
    expect(() => profileRepo.linkHostProfile(h.id, 'ghost')).toThrow('Profile not found: ghost')
  })
})

describe('legacy profile link sync (syncLegacyProfileLinks)', () => {
  it('listAllProfileLinks picks up profiles with host_id set via legacy path', async () => {
    // listAllProfileLinks calls syncLegacyProfileLinks which backfills
    // host_profile_links from connection_profiles.host_id — simulate by
    // creating a profile via createProfile+linkHostId (which writes host_id=NULL
    // but registers via host_profile_links table directly), then confirming
    // round-trip works.
    const host = repo.createHost({ name: 'h', hostname: 'h.local' })
    const profile = await profileRepo.createProfile({
      name: 'p',
      protocol: 'ssh',
      linkHostId: host.id
    })

    const links = profileRepo.listAllProfileLinks()
    expect(links.some((l) => l.hostId === host.id && l.profileId === profile.id)).toBe(true)
  })
})

// ── Import / export round-trip ───────────────────────────────────────────────
describe('exportHostsBundle / importHostsBundle round-trip', () => {
  it('exports and re-imports hosts with groups and profiles', async () => {
    const group = repo.createGroup('webservers')
    const host = repo.createHost({
      name: 'web01',
      hostname: '10.0.0.1',
      groupId: group.id,
      tags: ['web']
    })
    const profile = await profileRepo.createProfile({
      name: 'ssh-prod',
      protocol: 'ssh',
      username: 'deploy'
    })
    profileRepo.linkHostProfile(host.id, profile.id)

    const bundle = importExportService.exportHostsBundle()
    expect(bundle.hosts).toHaveLength(1)
    expect(bundle.groups).toHaveLength(1)
    expect(bundle.profiles).toHaveLength(1)

    // Reset and re-import into a fresh DB
    resetDatabaseForTest()
    setDatabaseForTest(':memory:')
    const freshHostRepo = new HostRepository()
    const freshProfileRepo = new ProfileRepository()
    const freshImportExportService = new HostImportExportService(freshHostRepo, freshProfileRepo)

    const imported = await freshImportExportService.importHostsBundle(bundle)
    expect(imported).toHaveLength(1)
    expect(imported[0].name).toBe('web01')
    expect(imported[0].tags).toEqual(['web'])

    // Group should be recreated
    const groups = freshHostRepo.listGroups()
    expect(groups.some((g) => g.name === 'webservers')).toBe(true)

    // Profile should be linked to the host
    const newGroupId = groups.find((g) => g.name === 'webservers')!.id
    const newHost = freshHostRepo.listHosts({ groupId: newGroupId })[0]
    const profiles = freshProfileRepo.listProfiles(newHost.id)
    expect(profiles.some((p) => p.name === 'ssh-prod')).toBe(true)
  })

  it('handles empty bundle without error', async () => {
    const bundle = importExportService.exportHostsBundle()
    expect(bundle.hosts).toHaveLength(0)
    const imported = await importExportService.importHostsBundle(bundle)
    expect(imported).toHaveLength(0)
  })
})

// ── Workspace ────────────────────────────────────────────────────────────────
describe('workspace save / load', () => {
  it('returns a default workspace on first load', () => {
    const ws = workspaceRepo.getActiveWorkspace()
    expect(ws.id).toBeTruthy()
    expect(ws.isLastActive).toBe(true)
  })

  it('saveWorkspace persists and loadWorkspace restores layout', () => {
    const state = {
      layout: { type: 'leaf', id: 'pane-1' } as unknown,
      panes: [
        {
          paneId: 'pane-1',
          sessionId: null,
          protocol: 'ssh' as const,
          title: 'web01',
          connectRequest: { hostId: 'h1', profileId: 'p1', protocol: 'ssh' as const }
        }
      ]
    }
    workspaceRepo.saveWorkspace(state)
    const loaded = workspaceRepo.loadWorkspace()
    expect(loaded.panes).toHaveLength(1)
    expect(loaded.panes[0].paneId).toBe('pane-1')
    expect(loaded.panes[0].connectRequest.hostId).toBe('h1')
  })

  it('loadWorkspace returns empty state when layout is null/corrupt', () => {
    const ws = workspaceRepo.getActiveWorkspace()
    // Default workspace has layout_json = 'null'
    expect(ws.layoutJson).toBe('null')
    const loaded = workspaceRepo.loadWorkspace()
    expect(loaded.layout).toBeNull()
    expect(loaded.panes).toEqual([])
  })
})

// ── Session snapshots ────────────────────────────────────────────────────────
describe('saveSessionSnapshot / getSessionSnapshot', () => {
  it('saves and retrieves a session snapshot', () => {
    // Use null for FK fields since no real host/profile rows exist
    workspaceRepo.saveSessionSnapshot({
      id: 'snap-1',
      hostId: null,
      profileId: null,
      protocol: 'ssh',
      title: 'web01',
      cwd: '/home/user',
      cols: 120,
      rows: 40,
      scrollbackSerialized: null
    })
    const snap = workspaceRepo.getSessionSnapshot('snap-1')
    expect(snap).toBeTruthy()
    expect(snap!.protocol).toBe('ssh')
    expect(snap!.cwd).toBe('/home/user')
    expect(snap!.cols).toBe(120)
    expect(snap!.disconnectedAt).toBeTruthy()
  })

  it('returns null for unknown snapshot id', () => {
    expect(workspaceRepo.getSessionSnapshot('ghost')).toBeNull()
  })

  it('overwrites existing snapshot on re-save', () => {
    const base = {
      id: 'snap-1',
      hostId: null,
      profileId: null,
      protocol: 'local_pty',
      title: 'shell',
      cwd: null,
      cols: 80,
      rows: 24,
      scrollbackSerialized: null
    } as const
    workspaceRepo.saveSessionSnapshot(base)
    workspaceRepo.saveSessionSnapshot({ ...base, cols: 200 })
    expect(workspaceRepo.getSessionSnapshot('snap-1')!.cols).toBe(200)
  })
})

// ── migratePaneBinding ───────────────────────────────────────────────────────
describe('migratePaneBinding (via loadWorkspace)', () => {
  it('falls back to an empty connectRequest for panes without one', () => {
    const ws = workspaceRepo.getActiveWorkspace()
    getDatabase()
      .prepare('UPDATE workspaces SET layout_json = ? WHERE id = ?')
      .run(
        JSON.stringify({
          layout: null,
          panes: [{ paneId: 'pane-legacy', sessionId: 'old-session-id', protocol: 'ssh', title: 'legacy' }]
        }),
        ws.id
      )

    const loaded = workspaceRepo.loadWorkspace()
    // migratePaneBinding should have populated connectRequest (even if empty)
    expect(loaded.panes[0].connectRequest).toBeDefined()
    expect(loaded.panes[0].paneId).toBe('pane-legacy')
  })

  it('uses snapshot data when pane has a sessionId and no connectRequest', async () => {
    // Create real host/profile to satisfy FK constraints
    const host = repo.createHost({ name: 'web01', hostname: '10.0.0.1' })
    const profile = await profileRepo.createProfile({ name: 'ssh-prod', protocol: 'ssh' })

    workspaceRepo.saveSessionSnapshot({
      id: 'snap-abc',
      hostId: host.id,
      profileId: profile.id,
      protocol: 'ssh',
      title: 'web01',
      cwd: null,
      cols: 80,
      rows: 24,
      scrollbackSerialized: null
    })

    const ws = workspaceRepo.getActiveWorkspace()
    getDatabase()
      .prepare('UPDATE workspaces SET layout_json = ? WHERE id = ?')
      .run(
        JSON.stringify({
          layout: null,
          panes: [{ paneId: 'pane-snap', sessionId: 'snap-abc', protocol: 'ssh', title: 'web01' }]
        }),
        ws.id
      )

    const loaded = workspaceRepo.loadWorkspace()
    const pane = loaded.panes[0]
    expect(pane.connectRequest.hostId).toBe(host.id)
    expect(pane.connectRequest.profileId).toBe(profile.id)
  })
})
