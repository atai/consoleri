import type { ReportHostEntry, ReportHostResultBase, ReportHostStatus } from './types'

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeHostEntry(raw: unknown): ReportHostEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<ReportHostEntry>
  if (!isNonEmptyString(entry.hostId) || !isNonEmptyString(entry.profileId)) return null
  return { hostId: entry.hostId, profileId: entry.profileId }
}

export function normalizeHostStatus(value: unknown): ReportHostStatus {
  if (value === 'ok' || value === 'fail' || value === 'skipped') return value
  return 'fail'
}

export function normalizeHostResultBase(raw: unknown): ReportHostResultBase | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<ReportHostResultBase>
  if (!isNonEmptyString(entry.hostId) || !isNonEmptyString(entry.profileId)) return null
  const durationMs =
    typeof entry.durationMs === 'number' && entry.durationMs >= 0 ? entry.durationMs : 0
  const result: ReportHostResultBase = {
    hostId: entry.hostId,
    profileId: entry.profileId,
    status: normalizeHostStatus(entry.status),
    durationMs
  }
  if (isNonEmptyString(entry.error)) result.error = entry.error
  if (Array.isArray(entry.log)) {
    result.log = entry.log.filter((line): line is string => typeof line === 'string')
  }
  return result
}

export function normalizeHostEntries(raw: unknown): ReportHostEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeHostEntry).filter((e): e is ReportHostEntry => e !== null)
}
