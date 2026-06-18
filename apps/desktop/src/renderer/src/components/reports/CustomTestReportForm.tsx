import { useState } from 'react'
import type {
  CustomTestCommand,
  Report,
  ReportConfig,
  ReportHostEntry
} from '@shared/types'
import { ReportHostEntriesSection } from './ReportHostEntriesSection'

interface CustomTestReportFormProps {
  report?: Report
  onSave: () => void | Promise<void>
  onCancel: () => void
}

function getInitialEntries(report: Report | undefined): ReportHostEntry[] {
  if (!report || report.config.type !== 'custom_test') return []
  return report.config.entries
}

function getInitialCommands(report: Report | undefined): CustomTestCommand[] {
  if (!report || report.config.type !== 'custom_test') return [{ command: '' }]
  return report.config.commands.length > 0
    ? report.config.commands
    : [{ command: '' }]
}

function getInitialContinueOnError(report: Report | undefined): boolean {
  if (!report || report.config.type !== 'custom_test') return false
  return report.config.continueOnError
}

export function CustomTestReportForm({
  report,
  onSave,
  onCancel
}: CustomTestReportFormProps): React.JSX.Element {
  const [name, setName] = useState(report?.name ?? '')
  const [entries, setEntries] = useState<ReportHostEntry[]>(() => getInitialEntries(report))
  const [commands, setCommands] = useState<CustomTestCommand[]>(() => getInitialCommands(report))
  const [continueOnError, setContinueOnError] = useState(() => getInitialContinueOnError(report))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCommandChange = (index: number, value: string): void => {
    setCommands(commands.map((c, i) => (i === index ? { command: value } : c)))
  }

  const handleAddCommand = (): void => {
    setCommands([...commands, { command: '' }])
  }

  const handleRemoveCommand = (index: number): void => {
    if (commands.length <= 1) {
      setCommands([{ command: '' }])
      return
    }
    setCommands(commands.filter((_, i) => i !== index))
  }

  const handleMoveCommand = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= commands.length) return
    const next = [...commands]
    const temp = next[index]!
    next[index] = next[target]!
    next[target] = temp
    setCommands(next)
  }

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
    const validCommands = commands
      .map((c) => ({ command: c.command.trim() }))
      .filter((c) => c.command.length > 0)
    if (validCommands.length === 0) {
      setError('Add at least one command')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const config: ReportConfig = {
        type: 'custom_test',
        entries,
        commands: validCommands,
        continueOnError
      }
      if (report) {
        await window.consoleri.reports.update(report.id, { name: trimmed, config })
      } else {
        await window.consoleri.reports.create({
          name: trimmed,
          type: 'custom_test',
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
    <div className="border-b border-[#30363d] bg-[#0d1117] p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-100">
        {report ? 'Edit custom test' : 'New custom test'}
      </h3>

      <label className="mb-3 block text-sm">
        <span className="text-gray-400">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-gray-100"
          placeholder="e.g. Post-deploy smoke test"
        />
      </label>

      <ReportHostEntriesSection
        entries={entries}
        onEntriesChange={setEntries}
        disabled={saving}
        className="mb-4"
      />

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-400">Commands (executed in order on each host)</span>
          <button
            type="button"
            onClick={handleAddCommand}
            disabled={saving}
            className="rounded border border-[#30363d] px-2 py-0.5 text-xs text-gray-300 hover:bg-[#21262d]"
          >
            + Add command
          </button>
        </div>

        <div className="space-y-2">
          {commands.map((cmd, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-xs text-gray-500">{index + 1}</span>
              <textarea
                value={cmd.command}
                onChange={(e) => handleCommandChange(index, e.target.value)}
                disabled={saving}
                rows={1}
                placeholder="e.g. systemctl status nginx"
                className="min-h-[2rem] flex-1 resize-y rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 font-mono text-sm text-gray-100"
              />
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleMoveCommand(index, -1)}
                  disabled={saving || index === 0}
                  className="rounded border border-[#30363d] px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#21262d] disabled:opacity-40"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveCommand(index, 1)}
                  disabled={saving || index === commands.length - 1}
                  className="rounded border border-[#30363d] px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#21262d] disabled:opacity-40"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveCommand(index)}
                  disabled={saving}
                  className="rounded border border-[#30363d] px-1.5 py-0.5 text-xs text-red-400 hover:bg-[#21262d]"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="mb-4 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={continueOnError}
          onChange={(e) => setContinueOnError(e.target.checked)}
          disabled={saving}
          className="mt-0.5"
        />
        <span>
          <span className="text-gray-300">Continue on error</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            When unchecked, remaining commands are skipped after a non-zero exit code.
          </span>
        </span>
      </label>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

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
    </div>
  )
}
