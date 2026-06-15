import { defaultPortForProtocol, isKeyFileRef, keyPathFromRef, labelFromKeyPath } from '@consoleri/core'
import type { ConnectionProfile, Host } from '@shared/types'

export function profileAuthLabel(profile: ConnectionProfile): string {
  if (profile.authMethod === 'none' && !profile.credentialRef) return 'no auth'
  if (!profile.credentialRef) {
    return profile.authMethod === 'password' ? 'password (not set)' : profile.authMethod
  }
  if (isKeyFileRef(profile.credentialRef)) {
    const path = keyPathFromRef(profile.credentialRef)
    return `key (${labelFromKeyPath(path)})`
  }
  if (profile.credentialRef.includes(':key')) return 'key (vault)'
  if (profile.authMethod === 'password' || profile.credentialRef.includes(':password')) {
    return 'password'
  }
  return profile.authMethod
}

export function profileJumpHostLabel(
  profile: ConnectionProfile,
  hosts: Host[]
): string | null {
  if (!profile.jumpHostId) return null
  const jump = hosts.find((h) => h.id === profile.jumpHostId)
  return jump ? jump.name : profile.jumpHostId
}

export function profilePortLabel(profile: ConnectionProfile): string | null {
  if (profile.protocol === 'rdp') {
    const port = (profile.extra.rdpPort as number) ?? defaultPortForProtocol('rdp')
    return `port ${port}`
  }
  if (profile.protocol === 'vnc') {
    const port = (profile.extra.vncPort as number) ?? defaultPortForProtocol('vnc')
    return `port ${port}`
  }
  return null
}

export function profileSummaryLines(
  profile: ConnectionProfile,
  hosts: Host[]
): string[] {
  const lines: string[] = []
  if (profile.username) lines.push(profile.username)
  lines.push(profileAuthLabel(profile))
  const jump = profileJumpHostLabel(profile, hosts)
  if (jump) lines.push(`via ${jump}`)
  const port = profilePortLabel(profile)
  if (port) lines.push(port)
  if (profile.shell && (profile.protocol === 'ssh' || profile.protocol === 'wsl')) {
    lines.push(profile.shell)
  }
  return lines
}
