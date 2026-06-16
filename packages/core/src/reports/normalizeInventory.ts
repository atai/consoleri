import type {
  InventoryConfig,
  InventoryHostData,
  InventoryHostResult,
  InventoryResult
} from './types'
import {
  isNonEmptyString,
  normalizeHostEntries,
  normalizeHostResultBase
} from './normalizeCommon'

function normalizeInventoryHostData(raw: unknown): InventoryHostData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Partial<InventoryHostData>
  if (!isNonEmptyString(data.os) || !isNonEmptyString(data.cpu)) return null
  if (typeof data.ramBytes !== 'number' || data.ramBytes < 0) return null
  const hostnames = Array.isArray(data.hostnames)
    ? data.hostnames.filter((h): h is string => isNonEmptyString(h))
    : []
  const ipv4 = Array.isArray(data.ipv4)
    ? data.ipv4.filter((ip): ip is string => isNonEmptyString(ip))
    : []
  const ipv6 = Array.isArray(data.ipv6)
    ? data.ipv6.filter((ip): ip is string => isNonEmptyString(ip))
    : []
  return { os: data.os, ramBytes: data.ramBytes, cpu: data.cpu, hostnames, ipv4, ipv6 }
}

export function normalizeInventoryConfig(input: unknown): InventoryConfig {
  if (typeof input !== 'object' || input === null) {
    return { type: 'inventory', entries: [] }
  }
  const raw = input as Partial<InventoryConfig>
  return {
    type: 'inventory',
    entries: normalizeHostEntries(raw.entries)
  }
}

function normalizeInventoryHostResult(raw: unknown): InventoryHostResult | null {
  const base = normalizeHostResultBase(raw)
  if (!base) return null
  const result: InventoryHostResult = { ...base }
  if (typeof raw === 'object' && raw !== null) {
    const entry = raw as Partial<InventoryHostResult>
    if (entry.inventory) {
      const inventory = normalizeInventoryHostData(entry.inventory)
      if (inventory) result.inventory = inventory
    }
  }
  return result
}

export function normalizeInventoryResult(input: unknown): InventoryResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Partial<InventoryResult>
  if (!isNonEmptyString(raw.runAt)) return null
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map(normalizeInventoryHostResult)
        .filter((e): e is InventoryHostResult => e !== null)
    : []
  return { type: 'inventory', runAt: raw.runAt, entries }
}
