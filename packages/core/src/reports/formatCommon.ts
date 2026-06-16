export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'OK'
    case 'fail':
      return 'FAIL'
    case 'skipped':
      return 'SKIPPED'
    default:
      return status.toUpperCase()
  }
}

export function formatRunTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function joinList(items: string[]): string {
  return items.length > 0 ? items.join(', ') : '—'
}

export function totalReportDurationMs(entries: Array<{ durationMs: number }>): number {
  return entries.reduce((sum, entry) => sum + entry.durationMs, 0)
}
