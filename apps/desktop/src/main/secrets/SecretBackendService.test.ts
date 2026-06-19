import { describe, expect, it } from 'vitest'
import { isVaultRef, makeVaultKv2Ref } from '@consoleri/core'
import { SecretBackendService } from './SecretBackendService'
import { LocalSecretBackend } from './LocalSecretBackend'
import { HashicorpVaultBackend } from './HashicorpVaultBackend'

describe('SecretBackendService', () => {
  const service = new SecretBackendService([new HashicorpVaultBackend(), new LocalSecretBackend()])

  it('routes vault refs to vault backend', () => {
    const ref = makeVaultKv2Ref('secret', 'consoleri/profiles/x', 'password')
    expect(isVaultRef(ref)).toBe(true)
    expect(service.resolveBackend(ref).id).toBe('vault')
  })

  it('routes profile refs to local backend', () => {
    expect(service.resolveBackend('profile:abc:password').id).toBe('local')
  })

  it('routes keyfile passphrase refs to local backend', () => {
    expect(service.resolveBackend('keyfile:/tmp/id_rsa:passphrase').id).toBe('local')
  })
})
