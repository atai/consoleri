import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionProfile } from '../../shared/types'

// ── Mocks ────────────────────────────────────────────────────────────────────
const { mockRetrieve, mockStore, mockDelete } = vi.hoisted(() => ({
  mockRetrieve: vi.fn<[string], Promise<string | null>>(),
  mockStore: vi.fn(),
  mockDelete: vi.fn()
}))

vi.mock('../secrets/SecretBackendService', () => ({
  secretBackendService: {
    retrieve: mockRetrieve,
    store: mockStore,
    delete: mockDelete
  }
}))

vi.mock('../vault/VaultSettingsRepository', () => ({
  vaultSettingsRepository: {
    getSettings: () => ({
      defaultKvMount: 'secret',
      secretPathPrefix: 'consoleri/profiles'
    }),
    getDefaultBackend: () => 'local' as const
  }
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn()
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
import { CredentialResolver, findSshProfile } from './CredentialResolver'
import { readFileSync } from 'fs'

const mockReadFileSync = vi.mocked(readFileSync)

function makeProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'prof-1',
    name: 'test',
    protocol: 'ssh',
    shell: null,
    username: 'user',
    authMethod: 'password',
    credentialRef: null,
    jumpHostId: null,
    extra: {},
    ...overrides
  }
}

let resolver: CredentialResolver

beforeEach(() => {
  vi.clearAllMocks()
  resolver = new CredentialResolver()
})

// ── resolveForProfile ─────────────────────────────────────────────────────────
describe('resolveForProfile', () => {
  it('returns only username when no credentialRef', async () => {
    const result = await resolver.resolveForProfile(makeProfile({ username: 'admin' }))
    expect(result).toEqual({ username: 'admin' })
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it('returns username and password for a local password ref', async () => {
    mockRetrieve.mockResolvedValue('s3cr3t')
    const result = await resolver.resolveForProfile(
      makeProfile({ credentialRef: 'profile:prof-1:password', username: 'deploy' })
    )
    expect(result.username).toBe('deploy')
    expect(result.password).toBe('s3cr3t')
    expect(result.privateKey).toBeUndefined()
  })

  it('returns username and privateKey for a local key ref', async () => {
    mockRetrieve.mockResolvedValue('-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----')
    const result = await resolver.resolveForProfile(
      makeProfile({ credentialRef: 'profile:prof-1:key', username: 'git' })
    )
    expect(result.username).toBe('git')
    expect(result.privateKey).toContain('OPENSSH')
    expect(result.password).toBeUndefined()
  })

  it('reads keyfile from disk and retrieves passphrase for keyfile ref', async () => {
    const keyContent = '-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'
    mockReadFileSync.mockReturnValue(keyContent as unknown as Buffer)
    mockRetrieve.mockResolvedValue('my-passphrase')

    const result = await resolver.resolveForProfile(
      makeProfile({
        credentialRef: 'keyfile:/home/user/.ssh/id_rsa',
        username: 'alice'
      })
    )
    expect(mockReadFileSync).toHaveBeenCalledWith('/home/user/.ssh/id_rsa', 'utf8')
    expect(result.privateKey).toBe(keyContent)
    expect(result.passphrase).toBe('my-passphrase')
  })

  it('returns privateKey without passphrase when no passphrase stored for keyfile', async () => {
    const keyContent = '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
    mockReadFileSync.mockReturnValue(keyContent as unknown as Buffer)
    mockRetrieve.mockResolvedValue(null)

    const result = await resolver.resolveForProfile(
      makeProfile({ credentialRef: 'keyfile:/home/user/.ssh/id_rsa' })
    )
    expect(result.privateKey).toBe(keyContent)
    expect(result.passphrase).toBeUndefined()
  })

  it('throws when keyfile cannot be read', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    await expect(
      resolver.resolveForProfile(
        makeProfile({ credentialRef: 'keyfile:/missing/id_rsa' })
      )
    ).rejects.toThrow('Could not read SSH key file: /missing/id_rsa')
  })

  it('throws with vault hint when vault ref secret is missing', async () => {
    mockRetrieve.mockResolvedValue(null)
    await expect(
      resolver.resolveForProfile(
        makeProfile({
          credentialRef: 'vault:kv2:secret/consoleri/profiles/prof-1#password',
          name: 'vault-profile'
        })
      )
    ).rejects.toThrow('Check Vault connectivity')
  })

  it('throws with OS storage hint when local ref secret is missing', async () => {
    mockRetrieve.mockResolvedValue(null)
    await expect(
      resolver.resolveForProfile(
        makeProfile({ credentialRef: 'profile:prof-1:password', name: 'local-profile' })
      )
    ).rejects.toThrow('Check OS secure storage')
  })
})

// ── resolvePassword ───────────────────────────────────────────────────────────
describe('resolvePassword', () => {
  it('returns null when no credentialRef', async () => {
    const result = await resolver.resolvePassword(makeProfile())
    expect(result).toBeNull()
  })

  it('returns null when secret is not found in backend', async () => {
    mockRetrieve.mockResolvedValue(null)
    const result = await resolver.resolvePassword(
      makeProfile({ credentialRef: 'profile:prof-1:password' })
    )
    expect(result).toBeNull()
  })

  it('returns the password when auth type is password', async () => {
    mockRetrieve.mockResolvedValue('mypassword')
    const result = await resolver.resolvePassword(
      makeProfile({ credentialRef: 'profile:prof-1:password' })
    )
    expect(result).toBe('mypassword')
  })

  it('returns null when auth type is privateKey (not a password ref)', async () => {
    mockRetrieve.mockResolvedValue('private-key-data')
    const result = await resolver.resolvePassword(
      makeProfile({ credentialRef: 'profile:prof-1:key' })
    )
    expect(result).toBeNull()
  })
})

// ── makeCredentialRef ─────────────────────────────────────────────────────────
describe('makeCredentialRef', () => {
  it('produces a local profile ref for local backend', () => {
    const ref = resolver.makeCredentialRef('local', 'prof-abc', 'password')
    expect(ref).toBe('profile:prof-abc:password')
  })

  it('produces a vault ref for vault backend', () => {
    const ref = resolver.makeCredentialRef('vault', 'prof-abc', 'password')
    expect(ref).toContain('vault:kv2:')
    expect(ref).toContain('prof-abc')
  })
})

// ── findSshProfile / resolveHostAndProfile ────────────────────────────────────
describe('findSshProfile', () => {
  it('returns the profile by id when found', () => {
    const profiles: ConnectionProfile[] = [
      makeProfile({ id: 'p1', protocol: 'rdp' }),
      makeProfile({ id: 'p2', protocol: 'ssh' })
    ]
    expect(findSshProfile(profiles, 'p1')?.id).toBe('p1')
  })

  it('falls back to first ssh profile when id not matched', () => {
    const profiles: ConnectionProfile[] = [
      makeProfile({ id: 'p1', protocol: 'rdp' }),
      makeProfile({ id: 'p2', protocol: 'ssh' })
    ]
    expect(findSshProfile(profiles, 'ghost')?.id).toBe('p2')
  })

  it('returns null when no ssh profile exists', () => {
    const profiles: ConnectionProfile[] = [makeProfile({ id: 'p1', protocol: 'rdp' })]
    expect(findSshProfile(profiles, undefined)).toBeNull()
  })
})
