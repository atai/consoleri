/**
 * Zod schemas for IPC channel inputs.
 *
 * Used in register.ts via createHandler() to validate data crossing the
 * IPC boundary before it reaches repositories or services.
 */
import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const Id = z.string().min(1, 'id must be non-empty')
export const OptionalId = z.string().optional()
export const NonEmptyString = z.string().min(1)

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ProtocolSchema = z.enum(['ssh', 'local_pty', 'rdp', 'vnc', 'wsl'])
export const AuthMethodSchema = z.enum(['password', 'key', 'none'])
export const OsTypeSchema = z.enum(['windows', 'linux', 'macos', 'unknown'])
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

// ── HostFilter ────────────────────────────────────────────────────────────────

export const HostFilterSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().nullable().optional()
})

// ── HostInput ─────────────────────────────────────────────────────────────────

export const HostInputSchema = z.object({
  name: NonEmptyString,
  hostname: NonEmptyString,
  port: z.number().int().min(1).max(65535).optional(),
  osType: OsTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().nullable().optional(),
  notes: z.string().optional(),
  defaultProfileId: z.string().nullable().optional(),
  uxProfileId: z.string().nullable().optional(),
  logVerbosity: z.enum(['quiet', 'info', 'verbose', 'trace']).optional(),
  relatedHostIds: z.array(z.string()).optional(),
  gatewayHostId: z.string().nullable().optional(),
  httpEndpoint: z.string().nullable().optional()
})

// ── ProfileInput ──────────────────────────────────────────────────────────────

export const ProfileInputSchema = z.object({
  name: NonEmptyString,
  protocol: ProtocolSchema,
  shell: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  authMethod: AuthMethodSchema.optional(),
  credentialRef: z.string().nullable().optional(),
  jumpHostId: z.string().nullable().optional(),
  extra: z.record(z.unknown()).optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  secretBackend: z.enum(['local', 'vault']).optional(),
  cloneFromProfileId: z.string().optional(),
  linkHostId: z.string().optional()
})

// ── UxProfileInput ────────────────────────────────────────────────────────────

export const UxProfileInputSchema = z.object({
  name: NonEmptyString,
  terminal: z.record(z.unknown()).optional(),
  chrome: z.record(z.unknown()).optional()
}).passthrough()

// ── Credential ref ────────────────────────────────────────────────────────────

const CREDENTIAL_PREFIXES = ['profile:', 'keyfile:', 'vault:'] as const

export const CredentialRefSchema = z
  .string()
  .min(1, 'credential ref must be non-empty')
  .refine(
    (ref) => CREDENTIAL_PREFIXES.some((prefix) => ref.startsWith(prefix)),
    (ref) => ({
      message: `credential ref "${ref}" must start with one of: ${CREDENTIAL_PREFIXES.join(', ')}`
    })
  )

// ── Session snapshot ──────────────────────────────────────────────────────────

export const SessionSnapshotSchema = z.object({
  id: Id,
  hostId: z.string().nullable(),
  profileId: z.string().nullable(),
  protocol: ProtocolSchema,
  title: z.string(),
  cwd: z.string().nullable(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  scrollbackSerialized: z.string().nullable()
})

// ── WorkspaceState ────────────────────────────────────────────────────────────

const PaneBindingSchema = z.object({
  paneId: z.string(),
  sessionId: z.string().nullable(),
  protocol: ProtocolSchema,
  title: z.string(),
  connectRequest: z.record(z.unknown())
})

export const WorkspaceStateSchema = z.object({
  layout: z.unknown(),
  panes: z.array(PaneBindingSchema)
})

// ── OpenSessionRequest ────────────────────────────────────────────────────────

export const OpenSessionRequestSchema = z.object({
  hostId: z.string().optional(),
  profileId: z.string().optional(),
  protocol: ProtocolSchema.optional(),
  title: z.string().optional(),
  localShell: z.enum(['powershell', 'pwsh', 'cmd', 'bash', 'wsl']).optional(),
  wslDistro: z.string().optional()
})

// ── DeployKeyRequest ──────────────────────────────────────────────────────────

export const DeployKeyRequestSchema = z.object({
  hostId: Id,
  profileId: z.string().optional(),
  keyPath: NonEmptyString,
  deployPassword: z.string().optional(),
  logId: z.string().optional(),
  openLog: z.boolean().optional()
})

// ── VaultSettingsUpdate ───────────────────────────────────────────────────────

export const VaultSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  url: z.string().optional(),
  authMethod: z.string().optional(),
  token: z.string().optional(),
  defaultKvMount: z.string().optional(),
  secretPathPrefix: z.string().optional(),
  tlsSkipVerify: z.boolean().optional(),
  appRoleRoleId: z.string().optional(),
  appRoleSecretId: z.string().optional(),
  defaultBackend: z.enum(['local', 'vault']).optional()
}).passthrough()

// ── ReportInput ───────────────────────────────────────────────────────────────

export const ReportInputSchema = z.object({
  name: NonEmptyString,
  type: z.enum(['connectivity_test', 'inventory', 'custom_test']),
  config: z.record(z.unknown()).optional()
}).passthrough()
