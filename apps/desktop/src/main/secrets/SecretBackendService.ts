import { isVaultRef } from '@consoleri/core'
import type { SecretBackend } from './SecretBackend'
import { localSecretBackend } from './LocalSecretBackend'
import { hashicorpVaultBackend } from './HashicorpVaultBackend'

export class SecretBackendService {
  private readonly backends: SecretBackend[]

  constructor(backends: SecretBackend[]) {
    this.backends = backends
  }

  resolveBackend(ref: string): SecretBackend {
    const backend = this.backends.find((candidate) => candidate.canHandle(ref))
    if (!backend) {
      throw new Error(`No secret backend handles ref: ${ref}`)
    }
    return backend
  }

  canHandle(ref: string): boolean {
    return this.backends.some((candidate) => candidate.canHandle(ref))
  }

  async store(ref: string, secret: string): Promise<void> {
    return this.resolveBackend(ref).store(ref, secret)
  }

  async retrieve(ref: string): Promise<string | null> {
    return this.resolveBackend(ref).retrieve(ref)
  }

  async delete(ref: string): Promise<void> {
    return this.resolveBackend(ref).delete(ref)
  }

  isVaultRef(ref: string | null): boolean {
    return isVaultRef(ref)
  }
}

export const secretBackendService = new SecretBackendService([
  hashicorpVaultBackend,
  localSecretBackend
])
