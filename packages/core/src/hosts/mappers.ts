import type { ConnectionProfile, Host, OsType } from '../types'
import { normalizeHostLogVerbosity } from '../logging/verbosity'

export function rowToHost(row: Record<string, unknown>): Host {
  return {
    id: row.id as string,
    name: row.name as string,
    hostname: row.hostname as string,
    port: row.port as number,
    osType: row.os_type as OsType,
    tags: JSON.parse((row.tags_json as string) || '[]'),
    groupId: (row.group_id as string) || null,
    notes: (row.notes as string) || '',
    defaultProfileId: (row.default_profile_id as string) || null,
    uxProfileId: (row.ux_profile_id as string) || null,
    logVerbosity: normalizeHostLogVerbosity(row.log_verbosity),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function rowToProfile(row: Record<string, unknown>): ConnectionProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    protocol: row.protocol as ConnectionProfile['protocol'],
    shell: (row.shell as string) || null,
    username: (row.username as string) || null,
    authMethod: row.auth_method as ConnectionProfile['authMethod'],
    credentialRef: (row.credential_ref as string) || null,
    jumpHostId: (row.jump_host_id as string) || null,
    extra: JSON.parse((row.extra_json as string) || '{}')
  }
}
