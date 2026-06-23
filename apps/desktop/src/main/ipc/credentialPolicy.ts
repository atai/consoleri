/**
 * Validates that a credential ref belongs to a known, safe prefix family.
 * Called before credentials:store and credentials:delete IPC handlers act
 * on any ref supplied by the renderer.
 */
const ALLOWED_PREFIXES = ['profile:', 'keyfile:', 'vault:'] as const

export function validateCredentialRef(ref: unknown): asserts ref is string {
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new Error(`Invalid credential ref: expected a non-empty string, got ${JSON.stringify(ref)}`)
  }
  const allowed = ALLOWED_PREFIXES.some((prefix) => ref.startsWith(prefix))
  if (!allowed) {
    throw new Error(
      `Invalid credential ref "${ref}": must start with one of ${ALLOWED_PREFIXES.join(', ')}`
    )
  }
}
