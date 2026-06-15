export const KEYFILE_REF_PREFIX = 'keyfile:'

export function makeKeyFileRef(absolutePath: string): string {
  return `${KEYFILE_REF_PREFIX}${absolutePath}`
}

export function isKeyFileRef(credentialRef: string | null): boolean {
  return credentialRef?.startsWith(KEYFILE_REF_PREFIX) ?? false
}

export function keyPathFromRef(credentialRef: string): string {
  if (!isKeyFileRef(credentialRef)) {
    throw new Error(`Not a keyfile ref: ${credentialRef}`)
  }
  return credentialRef.slice(KEYFILE_REF_PREFIX.length)
}

export function keyFilePassphraseRef(absolutePath: string): string {
  return `${KEYFILE_REF_PREFIX}${absolutePath}:passphrase`
}

export function labelFromKeyPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}
