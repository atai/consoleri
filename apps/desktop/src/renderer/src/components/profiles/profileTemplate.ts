import { defaultPortForProtocol, isKeyFileRef, keyPathFromRef } from '@consoleri/core'
import type { ConnectionProfile } from '@shared/types'

export function profileTemplateName(source: ConnectionProfile): string {
  return `${source.name} (copy)`
}

export function applyProfileTemplate(
  source: ConnectionProfile
): {
  name: string
  protocol: ConnectionProfile['protocol']
  username: string
  authMethod: ConnectionProfile['authMethod']
  shell: string
  jumpHostId: string
  rdpPort: number
  vncPort: number
  selectedKeyPath: string | null
  cloneFromProfileId: string
} {
  return {
    name: profileTemplateName(source),
    protocol: source.protocol,
    username: source.username ?? '',
    authMethod: source.authMethod,
    shell: source.shell ?? '/bin/bash',
    jumpHostId: source.jumpHostId ?? '',
    rdpPort: (source.extra.rdpPort as number) ?? defaultPortForProtocol('rdp'),
    vncPort: (source.extra.vncPort as number) ?? defaultPortForProtocol('vnc'),
    selectedKeyPath:
      source.credentialRef && isKeyFileRef(source.credentialRef)
        ? keyPathFromRef(source.credentialRef)
        : null,
    cloneFromProfileId: source.id
  }
}
