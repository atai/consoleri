import { APP_BUNDLE_KIND } from './types'
import type { AppExportDocument, ReportExportItem, WorkspaceExportItem } from './types'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeReportExportItem(raw: unknown): ReportExportItem | null {
  if (!isRecord(raw)) return null
  const exportId = typeof raw.exportId === 'string' ? raw.exportId : null
  const name = typeof raw.name === 'string' ? raw.name : ''
  const type = raw.type
  if (
    type !== 'connectivity_test' &&
    type !== 'inventory' &&
    type !== 'custom_test'
  )
    return null
  if (!exportId) return null
  return {
    exportId,
    name,
    type,
    config: isRecord(raw.config)
      ? (raw.config as unknown as ReportExportItem['config'])
      : ({ type } as never),
    lastRunAt: typeof raw.lastRunAt === 'string' ? raw.lastRunAt : null,
    lastResult: isRecord(raw.lastResult)
      ? (raw.lastResult as unknown as ReportExportItem['lastResult'])
      : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  }
}

function normalizePaneBinding(raw: unknown): { paneId: string; connectRequest: Record<string, unknown> } | null {
  if (!isRecord(raw)) return null
  if (typeof raw.paneId !== 'string') return null
  const connectRequest = isRecord(raw.connectRequest) ? raw.connectRequest : {}
  return { paneId: raw.paneId, connectRequest }
}

function normalizeWorkspaceExportItem(raw: unknown): WorkspaceExportItem | null {
  if (!isRecord(raw)) return null
  const name = typeof raw.name === 'string' ? raw.name : 'Default'
  const panes = Array.isArray(raw.panes)
    ? raw.panes.map(normalizePaneBinding).filter((p): p is NonNullable<typeof p> => p !== null)
    : []
  return { name, layout: raw.layout ?? null, panes }
}

export function isAppExportDocument(input: unknown): input is AppExportDocument {
  if (!isRecord(input)) return false
  return input.kind === APP_BUNDLE_KIND && input.version === 1
}

export function parseAppImportJson(json: string): AppExportDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  return normalizeAppExportDocument(parsed)
}

export function normalizeAppExportDocument(input: unknown): AppExportDocument {
  if (!isRecord(input)) {
    throw new Error('Not a valid app export document')
  }
  if (input.kind !== APP_BUNDLE_KIND) {
    throw new Error(`Expected kind "${APP_BUNDLE_KIND}", got "${String(input.kind)}"`)
  }
  if (input.version !== 1) {
    throw new Error(`Unsupported app bundle version: ${String(input.version)}`)
  }

  const settings = isRecord(input.settings) ? input.settings : {}
  const hosts = isRecord(input.hosts) ? input.hosts : {}
  const secrets = Array.isArray(input.secrets)
    ? (input.secrets as unknown[]).filter(
        (s): s is { ref: string; encryptedBlob: string } =>
          isRecord(s) && typeof s.ref === 'string' && typeof s.encryptedBlob === 'string'
      )
    : []

  const reports = Array.isArray(input.reports)
    ? (input.reports as unknown[]).map(normalizeReportExportItem).filter((r): r is ReportExportItem => r !== null)
    : []

  const workspace = input.workspace ? normalizeWorkspaceExportItem(input.workspace) : null

  return {
    kind: APP_BUNDLE_KIND,
    version: 1,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
    settings: settings as unknown as AppExportDocument['settings'],
    secrets,
    hosts: hosts as unknown as AppExportDocument['hosts'],
    reports,
    workspace
  }
}
