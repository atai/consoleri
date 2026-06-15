import { describe, expect, it } from 'vitest'
import { formatReportMarkdown, formatReportText } from './format'
import {
  normalizeConnectivityTestConfig,
  normalizeConnectivityTestResult,
  normalizeReportConfig
} from './normalize'
import type { Report } from './types'

const sampleReport: Report = {
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

const sampleResult = {
  runAt: '2026-06-15T12:00:00.000Z',
  entries: [
    { hostId: 'h1', profileId: 'p1', status: 'ok' as const, durationMs: 1200 },
    {
      hostId: 'h2',
      profileId: 'p2',
      status: 'fail' as const,
      durationMs: 20000,
      error: 'Connection timed out',
      log: ['Target: db.example:22', 'Connection failed: Connection timed out']
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
})

describe('normalizeConnectivityTestResult', () => {
  it('parses valid result', () => {
    const result = normalizeConnectivityTestResult(sampleResult)
    expect(result?.entries).toHaveLength(2)
    expect(result?.entries[1]?.error).toBe('Connection timed out')
  })

  it('returns null for invalid result', () => {
    expect(normalizeConnectivityTestResult({})).toBeNull()
  })
})

describe('formatReportMarkdown', () => {
  it('includes table and error section', () => {
    const md = formatReportMarkdown(sampleReport, sampleResult, labels)
    expect(md).toContain('# Prod check')
    expect(md).toContain('| web-01 | admin-key | OK |')
    expect(md).toContain('## Errors')
    expect(md).toContain('Connection timed out')
  })
})

describe('formatReportText', () => {
  it('includes summary line', () => {
    const text = formatReportText(sampleReport, sampleResult, labels)
    expect(text).toContain('[Connectivity test] Prod check')
    expect(text).toContain('✓ web-01')
    expect(text).toContain('✗ db-01')
    expect(text).toContain('Summary: 1 ok, 1 fail, 0 skipped')
  })
})
