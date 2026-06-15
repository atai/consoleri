import { useCallback, useEffect, useState } from 'react'
import type { Report } from '@shared/types'
import { ConnectivityReportForm } from './ConnectivityReportForm'
import { ReportListItem } from './ReportListItem'

export function ReportsManager(): React.JSX.Element {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingReportId, setEditingReportId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.consoleri.reports.list()
      setReports(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const unsub = window.consoleri.reports.onUpdated((report) => {
      setReports((prev) => {
        const index = prev.findIndex((r) => r.id === report.id)
        if (index === -1) return prev
        const next = [...prev]
        next[index] = report
        return next
      })
    })
    return unsub
  }, [])

  const handleOpen = (report: Report): void => {
    void window.consoleri.reports.openWindow(report.id)
  }

  const handleDelete = async (report: Report): Promise<void> => {
    if (!confirm(`Delete report "${report.name}"?`)) return
    await window.consoleri.reports.delete(report.id)
    await refresh()
  }

  const handleSaved = async (): Promise<void> => {
    setShowCreate(false)
    setEditingReportId(null)
    await refresh()
  }

  const editingReport = editingReportId
    ? reports.find((r) => r.id === editingReportId)
    : undefined

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#161b22]">
      <div className="shrink-0 border-b border-[#30363d] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">Reports</h1>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-[#30363d] px-2 py-0.5 text-xs text-gray-400 hover:bg-[#21262d]"
          >
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Saved host reports — run connectivity tests and export results
        </p>
      </div>

      <div className="shrink-0 border-b border-[#30363d] p-2">
        <button
          type="button"
          onClick={() => {
            setShowCreate(true)
            setEditingReportId(null)
          }}
          disabled={showCreate}
          className="w-full rounded border border-dashed border-[#30363d] py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-50"
        >
          + Create connectivity test
        </button>
      </div>

      {showCreate && (
        <ConnectivityReportForm onSave={() => void handleSaved()} onCancel={() => setShowCreate(false)} />
      )}

      {editingReport && (
        <ConnectivityReportForm
          report={editingReport}
          onSave={() => void handleSaved()}
          onCancel={() => setEditingReportId(null)}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No reports yet. Create a connectivity test above.</p>
        ) : (
          <ul>
            {reports.map((report) =>
              editingReportId === report.id ? null : (
                <ReportListItem
                  key={report.id}
                  report={report}
                  onOpen={() => handleOpen(report)}
                  onEdit={() => {
                    setEditingReportId(report.id)
                    setShowCreate(false)
                  }}
                  onDelete={() => void handleDelete(report)}
                />
              )
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
