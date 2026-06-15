import type { Host, OsType } from '../types'

export const HOST_LIST_VIEW_VERSION = 1

export type HostListGroupBy = 'none' | 'tag' | 'osType'
export type HostListSortBy = 'name' | 'hostname'
export type HostListSortDir = 'asc' | 'desc'
export type HostListGroupFilter = string | null | 'all'

export interface HostListViewSettings {
  version: number
  groupBy: HostListGroupBy
  selectedTags: string[]
  selectedGroupId: HostListGroupFilter
  selectedHostId: string | null
  collapsedSections: string[]
  sortBy: HostListSortBy
  sortDir: HostListSortDir
}

export interface HostListSection {
  id: string
  label: string
  hosts: Host[]
}

export const DEFAULT_HOST_LIST_VIEW: HostListViewSettings = {
  version: HOST_LIST_VIEW_VERSION,
  groupBy: 'none',
  selectedTags: [],
  selectedGroupId: 'all',
  selectedHostId: null,
  collapsedSections: [],
  sortBy: 'name',
  sortDir: 'asc'
}

const GROUP_BY_VALUES: HostListGroupBy[] = ['none', 'tag', 'osType']
const SORT_BY_VALUES: HostListSortBy[] = ['name', 'hostname']
const SORT_DIR_VALUES: HostListSortDir[] = ['asc', 'desc']

const OS_LABELS: Record<OsType, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
  unknown: 'Unknown'
}

const OS_ORDER: OsType[] = ['windows', 'linux', 'macos', 'unknown']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function normalizeGroupBy(value: unknown): HostListGroupBy {
  return GROUP_BY_VALUES.includes(value as HostListGroupBy)
    ? (value as HostListGroupBy)
    : DEFAULT_HOST_LIST_VIEW.groupBy
}

function normalizeSortBy(value: unknown): HostListSortBy {
  return SORT_BY_VALUES.includes(value as HostListSortBy)
    ? (value as HostListSortBy)
    : DEFAULT_HOST_LIST_VIEW.sortBy
}

function normalizeSortDir(value: unknown): HostListSortDir {
  return SORT_DIR_VALUES.includes(value as HostListSortDir)
    ? (value as HostListSortDir)
    : DEFAULT_HOST_LIST_VIEW.sortDir
}

function normalizeGroupFilter(value: unknown): HostListGroupFilter {
  if (value === 'all' || value === null) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  return DEFAULT_HOST_LIST_VIEW.selectedGroupId
}

function normalizeSelectedHostId(value: unknown): string | null {
  if (value === null) return null
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function migrateHostListViewV0toV1(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 1 }
}

function migrateHostListViewSettings(raw: Record<string, unknown>): Record<string, unknown> {
  let current = { ...raw }
  const version = typeof current.version === 'number' ? current.version : 0
  if (version < 1) {
    current = migrateHostListViewV0toV1(current)
  }
  return current
}

export function normalizeHostListViewSettings(input: unknown): HostListViewSettings {
  if (!isRecord(input)) {
    return { ...DEFAULT_HOST_LIST_VIEW }
  }

  const migrated = migrateHostListViewSettings(input)

  return {
    version: HOST_LIST_VIEW_VERSION,
    groupBy: normalizeGroupBy(migrated.groupBy),
    selectedTags: normalizeStringArray(migrated.selectedTags),
    selectedGroupId: normalizeGroupFilter(migrated.selectedGroupId),
    selectedHostId: normalizeSelectedHostId(migrated.selectedHostId),
    collapsedSections: normalizeStringArray(migrated.collapsedSections),
    sortBy: normalizeSortBy(migrated.sortBy),
    sortDir: normalizeSortDir(migrated.sortDir)
  }
}

export function parseHostListViewJson(raw: string | undefined | null): HostListViewSettings {
  if (!raw) return { ...DEFAULT_HOST_LIST_VIEW }
  try {
    return normalizeHostListViewSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_HOST_LIST_VIEW }
  }
}

export function mergeHostListViewSettings(
  current: HostListViewSettings,
  patch: Partial<HostListViewSettings>
): HostListViewSettings {
  return normalizeHostListViewSettings({ ...current, ...patch, version: HOST_LIST_VIEW_VERSION })
}

function compareLabels(a: string, b: string, sortDir: HostListSortDir): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' })
  return sortDir === 'desc' ? -cmp : cmp
}

export function sortHostListSections(
  sections: HostListSection[],
  sortDir: HostListSortDir = DEFAULT_HOST_LIST_VIEW.sortDir
): HostListSection[] {
  const untagged = sections.filter((section) => section.id === 'untagged')
  const rest = sections.filter((section) => section.id !== 'untagged')
  const sorted = [...rest].sort((a, b) => compareLabels(a.label, b.label, sortDir))
  return [...sorted, ...untagged]
}

function compareHosts(a: Host, b: Host, sortBy: HostListSortBy, sortDir: HostListSortDir): number {
  const fieldA = sortBy === 'hostname' ? a.hostname : a.name
  const fieldB = sortBy === 'hostname' ? b.hostname : b.name
  const cmp = fieldA.localeCompare(fieldB, undefined, { sensitivity: 'base' })
  return sortDir === 'desc' ? -cmp : cmp
}

export function sortHosts(
  hosts: Host[],
  sortBy: HostListSortBy = DEFAULT_HOST_LIST_VIEW.sortBy,
  sortDir: HostListSortDir = DEFAULT_HOST_LIST_VIEW.sortDir
): Host[] {
  return [...hosts].sort((a, b) => compareHosts(a, b, sortBy, sortDir))
}

export function groupHostsByTag(
  hosts: Host[],
  sectionSortDir: HostListSortDir = DEFAULT_HOST_LIST_VIEW.sortDir
): HostListSection[] {
  const tagMap = new Map<string, Host[]>()
  const untagged: Host[] = []

  for (const host of hosts) {
    if (host.tags.length === 0) {
      untagged.push(host)
      continue
    }
    for (const tag of host.tags) {
      const bucket = tagMap.get(tag)
      if (bucket) {
        bucket.push(host)
      } else {
        tagMap.set(tag, [host])
      }
    }
  }

  const sections: HostListSection[] = Array.from(tagMap.entries()).map(([tag, sectionHosts]) => ({
    id: `tag:${tag}`,
    label: `#${tag}`,
    hosts: sortHosts(sectionHosts, 'name', 'asc')
  }))

  if (untagged.length > 0) {
    sections.push({
      id: 'untagged',
      label: 'Untagged',
      hosts: sortHosts(untagged, 'name', 'asc')
    })
  }

  return sortHostListSections(sections, sectionSortDir)
}

export function groupHostsByOsType(
  hosts: Host[],
  sectionSortDir: HostListSortDir = DEFAULT_HOST_LIST_VIEW.sortDir
): HostListSection[] {
  const buckets = new Map<OsType, Host[]>()
  for (const os of OS_ORDER) {
    buckets.set(os, [])
  }

  for (const host of hosts) {
    buckets.get(host.osType)?.push(host)
  }

  const sections = OS_ORDER.flatMap((os) => {
    const sectionHosts = buckets.get(os) ?? []
    if (sectionHosts.length === 0) return []
    return [
      {
        id: `os:${os}`,
        label: OS_LABELS[os],
        hosts: sortHosts(sectionHosts, 'name', 'asc')
      }
    ]
  })

  return sortHostListSections(sections, sectionSortDir)
}

export function buildHostListSections(
  hosts: Host[],
  groupBy: HostListGroupBy,
  sortBy: HostListSortBy = DEFAULT_HOST_LIST_VIEW.sortBy,
  sortDir: HostListSortDir = DEFAULT_HOST_LIST_VIEW.sortDir
): HostListSection[] {
  if (groupBy === 'tag') {
    return groupHostsByTag(hosts, sortDir)
  }
  if (groupBy === 'osType') {
    return groupHostsByOsType(hosts, sortDir)
  }
  return [
    {
      id: 'all',
      label: '',
      hosts: sortHosts(hosts, sortBy, sortDir)
    }
  ]
}

export function hostListViewToGroupFilter(
  selectedGroupId: HostListGroupFilter
): string | null | undefined {
  if (selectedGroupId === 'all') return undefined
  return selectedGroupId
}
