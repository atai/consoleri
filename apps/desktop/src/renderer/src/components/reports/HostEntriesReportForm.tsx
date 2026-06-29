import { useState } from 'react'
import type { Report, ReportConfig, ReportHostEntry, ReportType } from '@shared/types'
import { ReportFormShell } from './ReportFormShell'
import { ReportHostEntriesSection } from './ReportHostEntriesSection'

interface HostEntriesReportFormProps {
  reportType: ReportType
  title: string
  report?: Report
  onSave: () => void | Promise<void>
  onCancel: () => void
}

function getInitialEntries(report: Report | undefined, reportType: ReportType): ReportHostEntry[] {
  if (!report || report.config.type !== reportType) return []
  return report.config.entries
}

export function HostEntriesReportForm({
  reportType,
  title,
  report,
  onSave,
  onCancel
}: HostEntriesReportFormProps): React.JSX.Element {
  const [name, setName] = useState(report?.name ?? '')
  const [entries, setEntries] = useState<ReportHostEntry[]>(() =>
    getInitialEntries(report, reportType)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Report name is required')
      return
    }
    if (entries.length === 0) {
      setError('Add at least one host')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const config = { type: reportType, entries } as ReportConfig
      if (report) {
        await window.consoleri.reports.update(report.id, { name: trimmed, config })
      } else {
        await window.consoleri.reports.create({
          name: trimmed,
          type: reportType,
          config
        })
      }
      await onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ReportFormShell
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-[#21262d] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <label className="mb-3 block text-sm">
        <span className="text-gray-400">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-gray-100"
          placeholder="e.g. Production hosts"
        />
      </label>

      <ReportHostEntriesSection
        entries={entries}
        onEntriesChange={setEntries}
        disabled={saving}
      />

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </ReportFormShell>
  )
}
