import { createHash } from 'node:crypto'

/** Stable id for ~/.ssh keys derived from normalized path. */
export function stableKeyId(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/').toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}
