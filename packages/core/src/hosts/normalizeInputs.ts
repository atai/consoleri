import type { OsType, Protocol, AuthMethod } from '../types'
import { normalizeHostLogVerbosity } from '../logging/verbosity'

// ── Input types ───────────────────────────────────────────────────────────────

export interface HostFormInput {
  name: string
  hostname: string
  port?: number
  osType?: string
  tags?: string[]
  groupId?: string | null
  notes?: string
  defaultProfileId?: string | null
  uxProfileId?: string | null
  logVerbosity?: string
  relatedHostIds?: string[]
  gatewayHostId?: string | null
  httpEndpoint?: string | null
}

export interface NormalizedHostInput {
  name: string
  hostname: string
  port: number
  osType: OsType
  tags: string[]
  groupId: string | null
  notes: string
  defaultProfileId: string | null
  uxProfileId: string | null
  logVerbosity: ReturnType<typeof normalizeHostLogVerbosity>
  relatedHostIds: string[]
  gatewayHostId: string | null
  httpEndpoint: string | null
}

export interface ProfileFormInput {
  name: string
  protocol?: string
  shell?: string | null
  username?: string | null
  authMethod?: string
  credentialRef?: string | null
  jumpHostId?: string | null
  extra?: Record<string, unknown>
}

export interface NormalizedProfileInput {
  name: string
  protocol: Protocol
  shell: string | null
  username: string | null
  authMethod: AuthMethod
  credentialRef: string | null
  jumpHostId: string | null
  extra: Record<string, unknown>
}

// ── Validation constants ──────────────────────────────────────────────────────

const VALID_OS_TYPES: ReadonlySet<string> = new Set(['windows', 'linux', 'macos', 'unknown'])
const VALID_PROTOCOLS: ReadonlySet<string> = new Set(['ssh', 'rdp', 'vnc', 'local_pty', 'wsl'])
const VALID_AUTH_METHODS: ReadonlySet<string> = new Set(['password', 'key', 'none'])

// ── normalizeHostInput ────────────────────────────────────────────────────────

export function normalizeHostInput(
  input: Partial<HostFormInput>
): { errors: Record<string, string>; normalized: NormalizedHostInput | null } {
  const errors: Record<string, string> = {}

  const name = (input.name ?? '').trim()
  if (!name) errors.name = 'Name is required'

  const hostname = (input.hostname ?? '').trim()
  if (!hostname) errors.hostname = 'Hostname is required'

  const port = input.port ?? 22
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.port = 'Port must be an integer between 1 and 65535'
  }

  const osType = input.osType ?? 'unknown'
  if (!VALID_OS_TYPES.has(osType)) {
    errors.osType = `Invalid OS type "${osType}"`
  }

  if (Object.keys(errors).length > 0) {
    return { errors, normalized: null }
  }

  const tags = Array.from(
    new Set(
      (input.tags ?? [])
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  )

  return {
    errors: {},
    normalized: {
      name,
      hostname,
      port,
      osType: osType as OsType,
      tags,
      groupId: input.groupId ?? null,
      notes: (input.notes ?? '').trim(),
      defaultProfileId: input.defaultProfileId ?? null,
      uxProfileId: input.uxProfileId ?? null,
      logVerbosity: normalizeHostLogVerbosity(input.logVerbosity),
      relatedHostIds: input.relatedHostIds ?? [],
      gatewayHostId: input.gatewayHostId ?? null,
      httpEndpoint: input.httpEndpoint ?? null
    }
  }
}

// ── normalizeProfileInput ─────────────────────────────────────────────────────

export function normalizeProfileInput(
  input: Partial<ProfileFormInput>
): { errors: Record<string, string>; normalized: NormalizedProfileInput | null } {
  const errors: Record<string, string> = {}

  const name = (input.name ?? '').trim()
  if (!name) errors.name = 'Name is required'

  const protocol = input.protocol ?? ''
  if (!protocol) {
    errors.protocol = 'Protocol is required'
  } else if (!VALID_PROTOCOLS.has(protocol)) {
    errors.protocol = `Invalid protocol "${protocol}"`
  }

  const authMethod = input.authMethod ?? 'password'
  if (!VALID_AUTH_METHODS.has(authMethod)) {
    errors.authMethod = `Invalid auth method "${authMethod}"`
  }

  if (Object.keys(errors).length > 0) {
    return { errors, normalized: null }
  }

  const rawUsername = input.username !== undefined ? input.username : null
  const username = typeof rawUsername === 'string' ? rawUsername.trim() || null : null

  return {
    errors: {},
    normalized: {
      name,
      protocol: protocol as Protocol,
      shell: input.shell ?? null,
      username,
      authMethod: authMethod as AuthMethod,
      credentialRef: input.credentialRef ?? null,
      jumpHostId: input.jumpHostId ?? null,
      extra: input.extra ?? {}
    }
  }
}
