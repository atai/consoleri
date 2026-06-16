import { describe, expect, it } from 'vitest'
import { formatInventoryReportMarkdown, formatInventoryReportText } from '../formatInventory'
import {
  INVENTORY_SECTION_CPU,
  INVENTORY_SECTION_HOSTNAMES,
  INVENTORY_SECTION_IPV4,
  INVENTORY_SECTION_IPV6,
  INVENTORY_SECTION_OS,
  INVENTORY_SECTION_RAM,
  buildInventoryCollectScript
} from './commands'
import { parseInventoryCollectOutput } from './parse'
import type { Report } from '../types'

const sampleInventoryOutput = `${INVENTORY_SECTION_OS}
Ubuntu 22.04.3 LTS
${INVENTORY_SECTION_RAM}
8589934592
${INVENTORY_SECTION_CPU}
Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz (8 cores)
${INVENTORY_SECTION_HOSTNAMES}
web-01 web-01.example.com
${INVENTORY_SECTION_IPV4}
10.0.0.15
192.168.1.10
${INVENTORY_SECTION_IPV6}
2001:db8::1
fe80::1%eth0`

const sampleInventoryReport: Report = {
  id: 'r2',
  name: 'Prod inventory',
  type: 'inventory',
  config: { type: 'inventory', entries: [{ hostId: 'h1', profileId: 'p1' }] },
  lastRunAt: '2026-06-15T12:00:00.000Z',
  lastResult: null,
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T12:00:00.000Z'
}

const labels = {
  hostName: () => 'web-01',
  profileName: () => 'admin-key'
}

describe('buildInventoryCollectScript', () => {
  it('includes all section markers', () => {
    const script = buildInventoryCollectScript()
    expect(script).toContain(INVENTORY_SECTION_OS)
    expect(script).toContain(INVENTORY_SECTION_RAM)
    expect(script).toContain(INVENTORY_SECTION_CPU)
    expect(script).toContain(INVENTORY_SECTION_HOSTNAMES)
    expect(script).toContain(INVENTORY_SECTION_IPV4)
    expect(script).toContain(INVENTORY_SECTION_IPV6)
  })
})

describe('parseInventoryCollectOutput', () => {
  it('parses full Ubuntu-style output', () => {
    const data = parseInventoryCollectOutput(sampleInventoryOutput)
    expect(data).toEqual({
      os: 'Ubuntu 22.04.3 LTS',
      ramBytes: 8589934592,
      cpu: 'Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz (8 cores)',
      hostnames: ['web-01', 'web-01.example.com'],
      ipv4: ['10.0.0.15', '192.168.1.10'],
      ipv6: ['2001:db8::1', 'fe80::1%eth0']
    })
  })

  it('returns null when required fields are missing', () => {
    expect(parseInventoryCollectOutput(`${INVENTORY_SECTION_OS}\nCentOS\n`)).toBeNull()
  })

  it('parses CentOS-style minimal output', () => {
    const output = `${INVENTORY_SECTION_OS}
CentOS Linux - 7.9.2009
${INVENTORY_SECTION_RAM}
4294967296
${INVENTORY_SECTION_CPU}
AMD EPYC (2 cores)
${INVENTORY_SECTION_HOSTNAMES}
db-01
${INVENTORY_SECTION_IPV4}
10.0.0.2
${INVENTORY_SECTION_IPV6}
`
    const data = parseInventoryCollectOutput(output)
    expect(data?.os).toBe('CentOS Linux - 7.9.2009')
    expect(data?.ramBytes).toBe(4294967296)
    expect(data?.ipv4).toEqual(['10.0.0.2'])
    expect(data?.ipv6).toEqual([])
  })
})

describe('formatInventoryReportMarkdown', () => {
  it('includes inventory columns', () => {
    const result = {
      type: 'inventory' as const,
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [
        {
          hostId: 'h1',
          profileId: 'p1',
          status: 'ok' as const,
          durationMs: 800,
          inventory: parseInventoryCollectOutput(sampleInventoryOutput)!
        }
      ]
    }
    const md = formatInventoryReportMarkdown(sampleInventoryReport, result, labels)
    expect(md).toContain('| Host | Profile | OS | RAM | CPU |')
    expect(md).toContain('Ubuntu 22.04.3 LTS')
    expect(md).toContain('8.00 GB')
  })
})

describe('formatInventoryReportText', () => {
  it('includes per-host inventory details', () => {
    const result = {
      type: 'inventory' as const,
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [
        {
          hostId: 'h1',
          profileId: 'p1',
          status: 'ok' as const,
          durationMs: 800,
          inventory: parseInventoryCollectOutput(sampleInventoryOutput)!
        }
      ]
    }
    const text = formatInventoryReportText(sampleInventoryReport, result, labels)
    expect(text).toContain('[Inventory] Prod inventory')
    expect(text).toContain('OS: Ubuntu 22.04.3 LTS')
    expect(text).toContain('Summary: 1 collected, 0 failed')
  })
})
