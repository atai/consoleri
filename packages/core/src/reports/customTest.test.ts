import { describe, expect, it } from 'vitest'
import {
  formatCustomTestReportMarkdown,
  formatCustomTestReportText,
  summarizeCustomTestResult
} from './formatCustomTest'
import {
  normalizeCustomTestConfig,
  normalizeCustomTestResult
} from './normalizeCustomTest'
import type { Report } from './types'

const sampleReport: Report = {
  id: 'r1',
  name: 'Smoke test',
  type: 'custom_test',
  config: {
    type: 'custom_test',
    entries: [{ hostId: 'h1', profileId: 'p1' }],
    commands: [{ command: 'uname -a' }, { command: 'false' }],
    continueOnError: false
  },
  lastRunAt: null,
  lastResult: null,
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z'
}

const labels = {
  hostName: (id: string) => (id === 'h1' ? 'web-01' : id),
  profileName: (id: string) => (id === 'p1' ? 'admin' : id)
}

describe('normalizeCustomTestConfig', () => {
  it('returns defaults for invalid input', () => {
    expect(normalizeCustomTestConfig(null)).toEqual({
      type: 'custom_test',
      entries: [],
      commands: [],
      continueOnError: false
    })
  })

  it('filters empty commands and normalizes continueOnError', () => {
    expect(
      normalizeCustomTestConfig({
        type: 'custom_test',
        entries: [{ hostId: 'h1', profileId: 'p1' }],
        commands: [{ command: '  ls  ' }, { command: '' }, { command: '   ' }],
        continueOnError: true
      })
    ).toEqual({
      type: 'custom_test',
      entries: [{ hostId: 'h1', profileId: 'p1' }],
      commands: [{ command: 'ls' }],
      continueOnError: true
    })
  })
})

describe('normalizeCustomTestResult', () => {
  it('normalizes command results with skipped status', () => {
    const result = normalizeCustomTestResult({
      type: 'custom_test',
      runAt: '2026-06-15T12:00:00.000Z',
      entries: [
        {
          hostId: 'h1',
          profileId: 'p1',
          status: 'fail',
          durationMs: 500,
          commands: [
            {
              index: 0,
              command: 'true',
              status: 'ok',
              code: 0,
              stdout: 'ok',
              stderr: '',
              durationMs: 100
            },
            {
              index: 1,
              command: 'false',
              status: 'fail',
              code: 1,
              stdout: '',
              stderr: 'failed',
              durationMs: 50
            },
            {
              index: 2,
              command: 'df -h',
              status: 'skipped',
              code: null,
              stdout: '',
              stderr: '',
              durationMs: 0
            }
          ]
        }
      ]
    })

    expect(result?.entries[0]?.commands).toHaveLength(3)
    expect(result?.entries[0]?.commands[2]?.code).toBeNull()
    expect(result?.entries[0]?.commands[2]?.status).toBe('skipped')
  })
})

describe('formatCustomTest', () => {
  const sampleResult = {
    type: 'custom_test' as const,
    runAt: '2026-06-15T12:00:00.000Z',
    entries: [
      {
        hostId: 'h1',
        profileId: 'p1',
        status: 'fail' as const,
        durationMs: 500,
        commands: [
          {
            index: 0,
            command: 'true',
            status: 'ok' as const,
            code: 0,
            stdout: 'done',
            stderr: '',
            durationMs: 100
          },
          {
            index: 1,
            command: 'false',
            status: 'fail' as const,
            code: 1,
            stdout: '',
            stderr: 'err',
            durationMs: 50
          },
          {
            index: 2,
            command: 'df -h',
            status: 'skipped' as const,
            code: null,
            stdout: '',
            stderr: '',
            durationMs: 0
          }
        ]
      }
    ]
  }

  it('summarizes hosts and commands', () => {
    expect(summarizeCustomTestResult(sampleResult)).toBe('0/1 hosts ok · 1/3 commands ok')
  })

  it('formats markdown with command details', () => {
    const md = formatCustomTestReportMarkdown(sampleReport, sampleResult, labels)
    expect(md).toContain('# Smoke test')
    expect(md).toContain('1/3 ok (1 skipped)')
    expect(md).toContain('## Command details')
    expect(md).toContain('`false`')
  })

  it('formats text with indented command output', () => {
    const text = formatCustomTestReportText(sampleReport, sampleResult, labels)
    expect(text).toContain('[Custom test] Smoke test')
    expect(text).toContain('exit 1 — false')
    expect(text).toContain('stderr: err')
  })
})
