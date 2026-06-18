import type {
  CustomTestCommand,
  CustomTestCommandResult,
  CustomTestConfig,
  CustomTestHostResult,
  CustomTestResult
} from './types'
import {
  isNonEmptyString,
  normalizeHostEntries,
  normalizeHostResultBase,
  normalizeHostStatus
} from './normalizeCommon'

export function normalizeCustomTestCommand(raw: unknown): CustomTestCommand | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<CustomTestCommand>
  if (!isNonEmptyString(entry.command)) return null
  return { command: entry.command.trim() }
}

export function normalizeCustomTestCommands(raw: unknown): CustomTestCommand[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeCustomTestCommand).filter((c): c is CustomTestCommand => c !== null)
}

export function normalizeCustomTestConfig(input: unknown): CustomTestConfig {
  if (typeof input !== 'object' || input === null) {
    return { type: 'custom_test', entries: [], commands: [], continueOnError: false }
  }
  const raw = input as Partial<CustomTestConfig>
  return {
    type: 'custom_test',
    entries: normalizeHostEntries(raw.entries),
    commands: normalizeCustomTestCommands(raw.commands),
    continueOnError: raw.continueOnError === true
  }
}

function normalizeCustomTestCommandResult(raw: unknown): CustomTestCommandResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Partial<CustomTestCommandResult>
  if (typeof entry.index !== 'number' || entry.index < 0) return null
  if (!isNonEmptyString(entry.command)) return null
  const status = normalizeHostStatus(entry.status)
  const durationMs =
    typeof entry.durationMs === 'number' && entry.durationMs >= 0 ? entry.durationMs : 0
  const code =
    entry.code === null
      ? null
      : typeof entry.code === 'number' && entry.code >= 0
        ? entry.code
        : null
  const result: CustomTestCommandResult = {
    index: entry.index,
    command: entry.command,
    status,
    code,
    stdout: typeof entry.stdout === 'string' ? entry.stdout : '',
    stderr: typeof entry.stderr === 'string' ? entry.stderr : '',
    durationMs
  }
  if (isNonEmptyString(entry.error)) result.error = entry.error
  return result
}

function normalizeCustomTestHostResult(raw: unknown): CustomTestHostResult | null {
  const base = normalizeHostResultBase(raw)
  if (!base) return null
  const result: CustomTestHostResult = { ...base, commands: [] }
  if (typeof raw === 'object' && raw !== null) {
    const entry = raw as Partial<CustomTestHostResult>
    if (Array.isArray(entry.commands)) {
      result.commands = entry.commands
        .map(normalizeCustomTestCommandResult)
        .filter((c): c is CustomTestCommandResult => c !== null)
    }
  }
  return result
}

export function normalizeCustomTestResult(input: unknown): CustomTestResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Partial<CustomTestResult>
  if (!isNonEmptyString(raw.runAt)) return null
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map(normalizeCustomTestHostResult)
        .filter((e): e is CustomTestHostResult => e !== null)
    : []
  return { type: 'custom_test', runAt: raw.runAt, entries }
}
