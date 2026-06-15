import type { Report } from '@shared/types'

interface ReportListItemProps {
  report: Report
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

function summarizeResult(report: Report): string | null {
  if (!report.lastResult) return null
  const ok = report.lastResult.entries.filter((e) => e.status === 'ok').length
  const fail = report.lastResult.entries.filter((e) => e.status === 'fail').length
  const skipped = report.lastResult.entries.filter((e) => e.status === 'skipped').length
  return `${ok} ok, ${fail} fail${skipped > 0 ? `, ${skipped} skipped` : ''}`
}

export function ReportListItem({
  report,
  onOpen,
  onEdit,
  onDelete
}: ReportListItemProps): React.JSX.Element {
  const hostCount =
    report.config.type === 'connectivity_test' ? report.config.entries.length : 0
  const summary = summarizeResult(report)

  return (
    <li className="flex items-center gap-2 border-b border-[#30363d] px-3 py-2 hover:bg-[#21262d]">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-sm font-medium text-gray-100">{report.name}</div>
        <div className="mt-0.5 text-xs text-gray-500">
          Connectivity test · {hostCount} host{hostCount === 1 ? '' : 's'}
          {report.lastRunAt && (
            <> · {new Date(report.lastRunAt).toLocaleString()}</>
          )}
          {summary && <> · {summary}</>}
        </div>
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-[#30363d] hover:text-gray-200"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-[#30363d]"
      >
        Delete
      </button>
    </li>
  )
}
