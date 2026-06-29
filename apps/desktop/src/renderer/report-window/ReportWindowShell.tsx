import type { ReactNode } from 'react'
import { formatDuration, totalReportDurationMs } from '@consoleri/core'
import type { Report, ReportFormatLabels, ReportProgressEvent, ReportResult } from '@shared/types'

function reportTypeLabel(type: Report['type']): string {
  switch (type) {
    case 'connectivity_test':
      return 'Connectivity test'
    case 'inventory':
      return 'Inventory'
    case 'custom_test':
      return 'Custom test'
    default:
      return type
  }
}

function progressActionLabel(type: Report['type']): string {
  switch (type) {
    case 'connectivity_test':
      return 'Testing'
    case 'inventory':
      return 'Collecting'
    case 'custom_test':
      return 'Running'
    default:
      return 'Processing'
  }
}

interface ReportWindowShellProps {
  report: Report
  result: ReportResult | null
  running: boolean
  progress: ReportProgressEvent | null
  error: string | null
  copyFeedback: string | null
  canCopy: boolean
  canRun: boolean
  labels: ReportFormatLabels
  onRun: () => void
  onCopyText: () => void
  onCopyMarkdown: () => void
  onSaveHtml: () => void
  children: ReactNode
}

export function ReportWindowShell({
  report,
  result,
  running,
  progress,
  error,
  copyFeedback,
  canCopy,
  canRun,
  labels,
  onRun,
  onCopyText,
  onCopyMarkdown,
  onSaveHtml,
  children
}: ReportWindowShellProps): React.JSX.Element {
  const progressPercent =
    progress && progress.total > 0 ? Math.round(((progress.index + 1) / progress.total) * 100) : 0

  const displayResult = result ?? report.lastResult
  const generationDurationMs = displayResult
    ? totalReportDurationMs(displayResult.entries)
    : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1117] text-gray-100">
      <header className="shrink-0 border-b border-[#30363d] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{report.name}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {reportTypeLabel(report.type)} · {report.config.entries.length} host
              {report.config.entries.length === 1 ? '' : 's'}
              {report.lastRunAt && (
                <> · Last run: {new Date(report.lastRunAt).toLocaleString()}</>
              )}
              {generationDurationMs !== null && generationDurationMs > 0 && (
                <> · Duration: {formatDuration(generationDurationMs)}</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!canCopy}
              onClick={onCopyText}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-40"
            >
              Copy text
            </button>
            <button
              type="button"
              disabled={!canCopy}
              onClick={onCopyMarkdown}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-40"
            >
              Copy MD
            </button>
            <button
              type="button"
              disabled={!canCopy}
              onClick={onSaveHtml}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-40"
            >
              Save HTML
            </button>
            <button
              type="button"
              disabled={running || !canRun}
              onClick={onRun}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {running ? 'Running…' : 'Generate'}
            </button>
          </div>
        </div>
        {running && progress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>
                {progressActionLabel(report.type)} {labels.hostName(progress.hostId)}
                {progress.commandIndex != null && progress.commandTotal != null && (
                  <> · command {progress.commandIndex + 1}/{progress.commandTotal}</>
                )}{' '}
                (host {progress.index + 1}/{progress.total})
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[#21262d]">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {copyFeedback && <p className="mt-2 text-xs text-green-400">{copyFeedback}</p>}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  )
}
