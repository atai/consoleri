import type { InventoryHostData } from '../types'
import {
  INVENTORY_SECTION_CPU,
  INVENTORY_SECTION_HOSTNAMES,
  INVENTORY_SECTION_IPV4,
  INVENTORY_SECTION_IPV6,
  INVENTORY_SECTION_OS,
  INVENTORY_SECTION_RAM
} from './commands'

function extractSection(output: string, marker: string, nextMarkers: string[]): string {
  const start = output.indexOf(marker)
  if (start === -1) return ''
  const contentStart = start + marker.length
  let end = output.length
  for (const next of nextMarkers) {
    const nextIndex = output.indexOf(next, contentStart)
    if (nextIndex !== -1 && nextIndex < end) {
      end = nextIndex
    }
  }
  return output.slice(contentStart, end).trim()
}

function parseOsSection(text: string): string | null {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line ?? null
}

function parseRamSection(text: string): number | null {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^\d+$/.test(l))
  if (!line) return null
  const bytes = Number.parseInt(line, 10)
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null
}

function parseCpuSection(text: string): string | null {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line ?? null
}

function parseListSection(text: string): string[] {
  const items = new Set<string>()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const part of trimmed.split(/\s+/)) {
      const item = part.trim()
      if (item) items.add(item)
    }
  }
  return [...items]
}

export function parseInventoryCollectOutput(stdout: string): InventoryHostData | null {
  const osText = extractSection(stdout, INVENTORY_SECTION_OS, [
    INVENTORY_SECTION_RAM,
    INVENTORY_SECTION_CPU,
    INVENTORY_SECTION_HOSTNAMES,
    INVENTORY_SECTION_IPV4,
    INVENTORY_SECTION_IPV6
  ])
  const ramText = extractSection(stdout, INVENTORY_SECTION_RAM, [
    INVENTORY_SECTION_CPU,
    INVENTORY_SECTION_HOSTNAMES,
    INVENTORY_SECTION_IPV4,
    INVENTORY_SECTION_IPV6
  ])
  const cpuText = extractSection(stdout, INVENTORY_SECTION_CPU, [
    INVENTORY_SECTION_HOSTNAMES,
    INVENTORY_SECTION_IPV4,
    INVENTORY_SECTION_IPV6
  ])
  const hostnamesText = extractSection(stdout, INVENTORY_SECTION_HOSTNAMES, [
    INVENTORY_SECTION_IPV4,
    INVENTORY_SECTION_IPV6
  ])
  const ipv4Text = extractSection(stdout, INVENTORY_SECTION_IPV4, [INVENTORY_SECTION_IPV6])
  const ipv6Text = extractSection(stdout, INVENTORY_SECTION_IPV6, [])

  const os = parseOsSection(osText)
  const ramBytes = parseRamSection(ramText)
  const cpu = parseCpuSection(cpuText)

  if (!os || ramBytes === null || !cpu) {
    return null
  }

  return {
    os,
    ramBytes,
    cpu,
    hostnames: parseListSection(hostnamesText),
    ipv4: parseListSection(ipv4Text),
    ipv6: parseListSection(ipv6Text)
  }
}
