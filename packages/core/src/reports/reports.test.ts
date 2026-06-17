import { describe, expect, it } from 'vitest'
import {
  formatReportMarkdown,
  formatReportText,
  summarizeReportResult,
  totalReportDurationMs
} from './format'
import {
  normalizeConnectivityTestConfig,
  normalizeConnectivityTestResult,
  normalizeInventoryConfig,
  normalizeInventoryResult,
  normalizeReportConfig,
  normalizeReportResult
} from './normalize'
import type { Report } from './types'

const sampleConnectivityReport: Report = {
  id: 'r1',
  name: 'Prod check',
  type: 'connectivity_test',
  config: {
    type: 'connectivity_test',
    entries: [
      { hostId: 'h1', profileId: 'p1' },
      { hostId: 'h2', profileId: 'p2' }
    ]
  },
  lastRunAt: '2026-06-15T12:00:00.000Z',
  lastResult: null,
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T12:00:00.000Z'
}

const sampleConnectivityResult = {
  type: 'connectivity_test' as const,
  runAt: '2026-06-15T12:00:00.000Z',
  entries: [
    {
      hostId: 'h1',
      profileId: 'p1',
      status: 'ok' as const,
      durationMs: 1200,
      pingStatus: 'ok' as const,
      pingDurationMs: 45
    },
    {
      hostId: 'h2',
      profileId: 'p2',
      status: 'fail' as const,
      durationMs: 20000,
      pingStatus: 'fail' as const,
      pingDurationMs: 3000,
      pingError: 'Request timed out',
      error: 'Connection timed out',
      log: ['Ping target: db.example', 'Ping failed: Request timed out', 'Target: db.example:22', 'Connection failed: Connection timed out']
    }
  ]
}

const labels = {
  hostName: (id: string) => (id === 'h1' ? 'web-01' : 'db-01'),
  profileName: (id: string) => (id === 'p1' ? 'admin-key' : 'admin-pass')
}

describe('normalizeConnectivityTestConfig', () => {
  it('returns empty entries for invalid input', () => {
    expect(normalizeConnectivityTestConfig(null)).toEqual({
      type: 'connectivity_test',
      entries: []
    })
  })

  it('filters invalid entries', () => {
    expect(
      normalizeConnectivityTestConfig({
        type: 'connectivity_test',
        entries: [{ hostId: 'h1', profileId: 'p1' }, { hostId: '', profileId: 'x' }]
      })
    ).toEqual({
      type: 'connectivity_test',
      entries: [{ hostId: 'h1', profileId: 'p1' }]
    })
  })
})

describe('normalizeReportConfig', () => {
  it('normalizes connectivity_test config', () => {
    const config = normalizeReportConfig('connectivity_test', {
      entries: [{ hostId: 'a', profileId: 'b' }]
    })
    expect(config.type).toBe('connectivity_test')
    expect(config.entries).toHaveLength(1)
  })

  it('normalizes inventory config', () => {
    const config = normalizeReportConfig('inventory', {
      entries: [{ hostId: 'a', profileId: 'b' }]
    })
    expect(config.type).toBe('inventory')
    expect(config.entries).toHaveLength(1)
  })
})

describe('normalizeConnectivityTestResult', () => {
  it('parses valid result', () => {
    const result = normalizeConnectivityTestResult(sampleConnectivityResult)
    expect(result?.type).toBe('connectivity_test')
    expect(result?.entries).toHaveLength(2)
    expect(result?.entries[1]?.error).toBe('Connection timed out')
  })

  it('parses ping fields', () => {
    const result = normalizeConnectivityTestResult({
      type: 'connectivity_test',
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [
        {
          hostId: 'h1',
          profileId: 'p1',
          status: 'ok',
          durationMs: 100,
          pingStatus: 'fail',
          pingDurationMs: 50,
          pingError: 'timeout'
        }
      ]
    })
    expect(result?.entries[0]?.pingStatus).toBe('fail')
    expect(result?.entries[0]?.pingDurationMs).toBe(50)
    expect(result?.entries[0]?.pingError).toBe('timeout')
  })

  it('omits invalid ping status from legacy results', () => {
    const result = normalizeConnectivityTestResult({
      type: 'connectivity_test',
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [{ hostId: 'h1', profileId: 'p1', status: 'ok', durationMs: 100 }]
    })
    expect(result?.entries[0]?.pingStatus).toBeUndefined()
  })

  it('infers type from report type when missing', () => {
    const legacy = {
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [{ hostId: 'h1', profileId: 'p1', status: 'ok', durationMs: 100 }]
    }
    const result = normalizeReportResult('connectivity_test', legacy)
    expect(result?.type).toBe('connectivity_test')
  })
})

describe('normalizeInventoryResult', () => {
  it('parses valid inventory result', () => {
    const result = normalizeInventoryResult({
      type: 'inventory',
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [
        {
          hostId: 'h1',
          profileId: 'p1',
          status: 'ok',
          durationMs: 500,
          inventory: {
            os: 'Ubuntu - 22.04.3 LTS',
            ramBytes: 8589934592,
            cpu: 'Intel Xeon (4 cores)',
            hostnames: ['web-01', 'web-01.local'],
            ipv4: ['10.0.0.1'],
            ipv6: ['2001:db8::1']
          }
        }
      ]
    })
    expect(result?.entries[0]?.inventory?.os).toBe('Ubuntu - 22.04.3 LTS')
  })
})

describe('formatReportMarkdown', () => {
  it('includes table and error section for connectivity', () => {
    const md = formatReportMarkdown(sampleConnectivityReport, sampleConnectivityResult, labels)
    expect(md).toContain('# Prod check')
    expect(md).toContain('| Host | Profile | Ping | SSH | Duration |')
    expect(md).toContain('| web-01 | admin-key | OK | OK |')
    expect(md).toContain('## Errors')
    expect(md).toContain('Connection timed out')
    expect(md).toContain('Request timed out')
  })
})

describe('formatReportText', () => {
  it('includes summary line for connectivity', () => {
    const text = formatReportText(sampleConnectivityReport, sampleConnectivityResult, labels)
    expect(text).toContain('[Connectivity test] Prod check')
    expect(text).toContain('ping:OK ssh:OK')
    expect(text).toContain('ping:FAIL ssh:FAIL')
    expect(text).toContain('Summary: ping 1 ok, 1 fail | ssh 1 ok, 1 fail, 0 skipped')
  })
})

describe('summarizeReportResult', () => {
  it('summarizes connectivity result', () => {
    expect(summarizeReportResult(sampleConnectivityResult)).toBe(
      'ping 1/1 | ssh 1 ok, 1 fail, 0 skipped'
    )
  })
})

describe('totalReportDurationMs', () => {
  it('sums entry durations', () => {
    expect(totalReportDurationMs(sampleConnectivityResult.entries)).toBe(21200)
  })
})

describe('normalizeInventoryConfig', () => {
  it('returns empty entries for invalid input', () => {
    expect(normalizeInventoryConfig(null)).toEqual({ type: 'inventory', entries: [] })
  })
})
