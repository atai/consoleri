import { parseVaultRef, vaultPathForProfile, type VaultSettings } from '@consoleri/core'
import { vaultAuthManager } from './VaultAuthManager'
import { vaultRequest } from './vaultClient'

export interface KvPreflightResult {
  allowed: boolean
  skipped: boolean
  dataPath: string
  metadataPath: string
  dataCapabilities: string[]
  metadataCapabilities: string[]
  warning?: string
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('not found') || message.includes('404')
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.toLowerCase().includes('permission denied') ||
    message.includes('403') ||
    message.toLowerCase().includes('forbidden')
  )
}

export function vaultKvPathsForProfile(
  settings: VaultSettings,
  profileId: string
): { dataPath: string; metadataPath: string; logicalPath: string } {
  const mount = settings.defaultKvMount.replace(/^\/+|\/+$/g, '')
  const logicalPath = vaultPathForProfile(settings.secretPathPrefix, profileId)
  return {
    logicalPath,
    dataPath: `${mount}/data/${logicalPath}`,
    metadataPath: `${mount}/metadata/${logicalPath}`
  }
}

export async function checkVaultKvWritePreflight(
  settings: VaultSettings,
  profileId: string
): Promise<KvPreflightResult> {
  const { dataPath, metadataPath, logicalPath } = vaultKvPathsForProfile(settings, profileId)
  const token = await vaultAuthManager.getToken(settings)

  try {
    const response = await vaultRequest<{
      data?: { capabilities?: Record<string, string[]> }
    }>({
      address: settings.address,
      path: 'sys/capabilities-self',
      method: 'POST',
      token,
      namespace: settings.namespace,
      tlsSkipVerify: settings.tlsSkipVerify,
      body: { paths: [dataPath, metadataPath] }
    })

    const capabilities = response.data?.capabilities ?? {}
    const dataCapabilities = capabilities[dataPath] ?? []
    const metadataCapabilities = capabilities[metadataPath] ?? []
    const canWriteData = dataCapabilities.includes('create') || dataCapabilities.includes('update')
    const canDeleteMetadata = metadataCapabilities.includes('delete')

    return {
      allowed: canWriteData,
      skipped: false,
      dataPath,
      metadataPath,
      dataCapabilities,
      metadataCapabilities,
      warning: canDeleteMetadata
        ? undefined
        : `Missing delete on ${metadataPath}; profile delete may leave orphaned Vault metadata`
    }
  } catch (error) {
    if (isPermissionError(error) || isNotFoundError(error)) {
      return {
        allowed: false,
        skipped: false,
        dataPath,
        metadataPath,
        dataCapabilities: [],
        metadataCapabilities: [],
        warning: isNotFoundError(error)
          ? `capabilities-self unavailable for ${logicalPath}`
          : undefined
      }
    }
    return {
      allowed: true,
      skipped: true,
      dataPath,
      metadataPath,
      dataCapabilities: [],
      metadataCapabilities: [],
      warning: 'capabilities-self check skipped; proceeding with direct write'
    }
  }
}

export function formatKvPreflightDenial(result: KvPreflightResult): string {
  return (
    `Vault permission denied for ${result.dataPath}. ` +
    `Required: create or update on data path. ` +
    `Got: [${result.dataCapabilities.join(', ') || 'none'}]`
  )
}

export async function checkVaultKvProbeWrite(settings: VaultSettings): Promise<{
  canWriteKv: boolean
  skipped: boolean
  dataPath: string
  dataCapabilities: string[]
  error?: string
}> {
  const probe = await checkVaultKvWritePreflight(settings, '_probe')
  if (probe.skipped) {
    return {
      canWriteKv: true,
      skipped: true,
      dataPath: probe.dataPath,
      dataCapabilities: probe.dataCapabilities,
      error: probe.warning
    }
  }
  if (!probe.allowed) {
    return {
      canWriteKv: false,
      skipped: false,
      dataPath: probe.dataPath,
      dataCapabilities: probe.dataCapabilities,
      error: formatKvPreflightDenial(probe)
    }
  }
  return {
    canWriteKv: true,
    skipped: false,
    dataPath: probe.dataPath,
    dataCapabilities: probe.dataCapabilities,
    error: probe.warning
  }
}

export function vaultDataPathFromRef(credentialRef: string): string {
  const { mount, logicalPath } = parseVaultRef(credentialRef)
  return `${mount}/data/${logicalPath}`
}
