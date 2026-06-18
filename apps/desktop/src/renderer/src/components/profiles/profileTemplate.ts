import { defaultPortForProtocol, isKeyFileRef, keyPathFromRef, makeKeyFileRef, resolveRdpPort } from '@consoleri/core'
import type { ConnectionProfile, ProfileInput } from '@shared/types'

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
    shell: source.shell ?? '',
    jumpHostId: source.jumpHostId ?? '',
    rdpPort: resolveRdpPort(source.extra),
    vncPort: (source.extra.vncPort as number) ?? defaultPortForProtocol('vnc'),
    selectedKeyPath:
      source.credentialRef && isKeyFileRef(source.credentialRef)
        ? keyPathFromRef(source.credentialRef)
        : null,
    cloneFromProfileId: source.id
  }
}

export function profileInputFromTemplate(source: ConnectionProfile): ProfileInput {
  const template = applyProfileTemplate(source)
  const extra: Record<string, unknown> = {}
  if (template.protocol === 'rdp') extra.rdpPort = template.rdpPort
  if (template.protocol === 'vnc') extra.vncPort = template.vncPort

  const input: ProfileInput = {
    name: template.name,
    protocol: template.protocol,
    shell:
      template.protocol === 'ssh' || template.protocol === 'wsl' ? template.shell || null : null,
    username: template.username || null,
    authMethod: template.authMethod,
    jumpHostId: template.protocol === 'ssh' && template.jumpHostId ? template.jumpHostId : null,
    extra,
    cloneFromProfileId: template.cloneFromProfileId
  }

  if (template.authMethod === 'key' && template.selectedKeyPath) {
    input.credentialRef = makeKeyFileRef(template.selectedKeyPath)
  }

  return input
}
