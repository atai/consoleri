import { createHash } from 'node:crypto'

export interface ParsedPublicKey {
  keyType: string
  fingerprint: string
  comment: string
  line: string
}

const PUB_KEY_RE = /^(ssh-[a-z0-9-]+)\s+([A-Za-z0-9+/]+=*)(?:\s+(.*))?$/

export function parsePublicKeyLine(line: string): ParsedPublicKey | null {
  const trimmed = line.trim()
  const match = PUB_KEY_RE.exec(trimmed)
  if (!match) return null

  const keyType = match[1]
  const base64 = match[2]
  const comment = (match[3] ?? '').trim()

  let wire: Buffer
  try {
    wire = Buffer.from(base64, 'base64')
  } catch {
    return null
  }

  const hash = createHash('sha256').update(wire).digest('base64').replace(/=+$/, '')
  const fingerprint = `SHA256:${hash}`

  return { keyType, fingerprint, comment, line: trimmed }
}

export function parsePublicKeyFile(content: string): ParsedPublicKey | null {
  const firstLine = content.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'))
  if (!firstLine) return null
  return parsePublicKeyLine(firstLine)
}
