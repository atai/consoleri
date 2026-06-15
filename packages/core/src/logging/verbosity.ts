export type HostLogVerbosity = 'quiet' | 'info' | 'verbose' | 'trace'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

const MIN_LEVEL: Record<HostLogVerbosity, LogLevel> = {
  quiet: 'warn',
  info: 'info',
  verbose: 'debug',
  trace: 'debug'
}

export const HOST_LOG_VERBOSITY_OPTIONS: Array<{
  value: HostLogVerbosity
  label: string
  description: string
}> = [
  { value: 'quiet', label: 'Quiet', description: 'Warnings and errors only' },
  { value: 'info', label: 'Normal', description: 'Standard connection messages' },
  { value: 'verbose', label: 'Verbose', description: 'Detailed connection steps' },
  { value: 'trace', label: 'Trace (ssh -vvv)', description: 'Full SSH wire-level debug output' }
]

export function normalizeHostLogVerbosity(value: unknown): HostLogVerbosity {
  if (value === 'quiet' || value === 'info' || value === 'verbose' || value === 'trace') {
    return value
  }
  return 'info'
}

export function shouldIncludeLogEntry(
  verbosity: HostLogVerbosity,
  level: LogLevel,
  meta?: Record<string, unknown>
): boolean {
  const minLevel = MIN_LEVEL[verbosity]
  if (LEVEL_RANK[level] > LEVEL_RANK[minLevel]) return false
  if (level === 'debug' && meta?.source === 'ssh2' && verbosity !== 'trace') return false
  return true
}

export function sshDebugEnabled(verbosity: HostLogVerbosity): boolean {
  return verbosity === 'trace'
}

export function maxLogEntriesForVerbosity(verbosity: HostLogVerbosity): number {
  return verbosity === 'trace' ? 5000 : 500
}
