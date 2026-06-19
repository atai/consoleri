export interface SecretBackend {
  readonly id: 'local' | 'vault'
  canHandle(ref: string): boolean
  store(ref: string, secret: string): Promise<void>
  retrieve(ref: string): Promise<string | null>
  delete(ref: string): Promise<void>
}
