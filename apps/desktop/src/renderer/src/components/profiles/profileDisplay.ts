import {
  defaultPortForProtocol,
  isKeyFileRef,
  keyPathFromRef,
  labelFromKeyPath,
  resolveRdpPort
} from '@consoleri/core'
import type { AuthMethod, ConnectionProfile, Host, Protocol, SshKeyInfo } from '@shared/types'

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

function suggestAuthLabel(params: {
  protocol: Protocol
  authMethod: AuthMethod
  selectedKeyPath?: string | null
  privateKey?: string
  sshKeys?: SshKeyInfo[]
}): string {
  const supportsAuth =
    params.protocol === 'ssh' || params.protocol === 'rdp' || params.protocol === 'vnc'
  if (!supportsAuth) return 'none'
  if (params.authMethod !== 'key') return params.authMethod

  if (params.selectedKeyPath) {
    const match = params.sshKeys?.find((k) => k.privateKeyPath === params.selectedKeyPath)
    return match?.label ?? labelFromKeyPath(params.selectedKeyPath)
  }
  if (params.privateKey?.trim()) return 'vault'
  return 'key'
}

export function suggestProfileName(params: {
  username: string
  protocol: Protocol
  authMethod: AuthMethod
  jumpHostId: string
  hosts: Host[]
  selectedKeyPath?: string | null
  privateKey?: string
  sshKeys?: SshKeyInfo[]
}): string {
  const displayUsername = params.username.trim() || 'noname'
  const auth = suggestAuthLabel(params)
  const parts = [params.protocol, auth]

  if (params.protocol === 'ssh' && params.jumpHostId) {
    const jump = profileJumpHostLabel(
      { jumpHostId: params.jumpHostId } as ConnectionProfile,
      params.hosts
    )
    if (jump) parts.push(jump)
  }

  return `${displayUsername} (${parts.join(' - ')})`
}

export function profilePortLabel(profile: ConnectionProfile): string | null {
  if (profile.protocol === 'rdp') {
    const port = resolveRdpPort(profile.extra)
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
