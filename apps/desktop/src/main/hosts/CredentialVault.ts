import { localSecretBackend } from '../secrets/LocalSecretBackend'
import { secretBackendService } from '../secrets/SecretBackendService'

/** @deprecated Use secretBackendService or localSecretBackend directly */
export class CredentialVault {
  store(ref: string, secret: string): Promise<void> {
    return secretBackendService.store(ref, secret)
  }

  retrieve(ref: string): Promise<string | null> {
    return secretBackendService.retrieve(ref)
  }

  delete(ref: string): Promise<void> {
    return secretBackendService.delete(ref)
  }
}

export const credentialVault = new CredentialVault()
export { localSecretBackend, secretBackendService }
