import { describe, expect, it, vi, beforeEach } from 'vitest'
import { formatKvPreflightDenial } from './VaultKvPreflight'

const vaultRequestMock = vi.fn()
const getTokenMock = vi.fn()

vi.mock('./vaultClient', () => ({
  vaultRequest: (...args: unknown[]) => vaultRequestMock(...args)
}))

vi.mock('./VaultAuthManager', () => ({
  vaultAuthManager: {
    getToken: (...args: unknown[]) => getTokenMock(...args)
  }
}))

const settings = {
  enabled: true,
  address: 'https://vault.example.com:8200',
  namespace: '',
  defaultKvMount: 'secret',
  secretPathPrefix: 'consoleri',
  defaultBackend: 'local' as const,
  auth: { method: 'token' as const, hasToken: true },
  tlsSkipVerify: false
}

describe('VaultKvPreflight', () => {
  beforeEach(() => {
    vaultRequestMock.mockReset()
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('test-token')
  })

  it('allows write when capabilities include update', async () => {
    vaultRequestMock.mockResolvedValue({
      data: {
        capabilities: {
          'secret/data/consoleri/profiles/p1': ['read', 'update'],
          'secret/metadata/consoleri/profiles/p1': ['delete']
        }
      }
    })

    const { checkVaultKvWritePreflight } = await import('./VaultKvPreflight')
    const result = await checkVaultKvWritePreflight(settings, 'p1')
    expect(result.allowed).toBe(true)
    expect(result.skipped).toBe(false)
  })

  it('denies write when capabilities are missing', async () => {
    vaultRequestMock.mockResolvedValue({
      data: {
        capabilities: {
          'secret/data/consoleri/profiles/p1': ['read'],
          'secret/metadata/consoleri/profiles/p1': []
        }
      }
    })

    const { checkVaultKvWritePreflight } = await import('./VaultKvPreflight')
    const result = await checkVaultKvWritePreflight(settings, 'p1')
    expect(result.allowed).toBe(false)
    expect(formatKvPreflightDenial(result)).toMatch(/permission denied/i)
  })

  it('skips preflight when capabilities-self is unavailable', async () => {
    vaultRequestMock.mockRejectedValue(new Error('connection reset'))

    const { checkVaultKvWritePreflight } = await import('./VaultKvPreflight')
    const result = await checkVaultKvWritePreflight(settings, 'p1')
    expect(result.skipped).toBe(true)
    expect(result.allowed).toBe(true)
  })
})
