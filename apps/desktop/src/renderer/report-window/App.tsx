import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { formatReportMarkdown, formatReportText } from '@consoleri/core'
import type {
  ConnectionProfile,
  ConnectivityTestHostResult,
  ConnectivityTestResult,
  Host,
  Report,
  ReportProgressEvent
} from '@shared/types'

declare global {
  interface Window {
    reportApi: {
      getReportId: () => string
      getReport: (reportId: string) => Promise<Report | null>
      run: (reportId: string) => Promise<ConnectivityTestResult>
      onProgress: (cb: (event: ReportProgressEvent) => void) => () => void
      writeClipboard: (text: string) => Promise<void>
      listHosts: () => Promise<Host[]>
      listProfiles: (hostId?: string) => Promise<ConnectionProfile[]>
    }
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusBadge(status: string): string {
  switch (status) {
    case 'ok':
      return 'text-green-400'
    case 'skipped':
      return 'text-yellow-400'
    default:
      return 'text-red-400'
  }
}

export function ReportWindowApp(): React.JSX.Element {
  const reportId = window.reportApi.getReportId()
  const [report, setReport] = useState<Report | null>(null)
  const [result, setResult] = useState<ConnectivityTestResult | null>(null)
  const [hosts, setHosts] = useState<Host[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ReportProgressEvent | null>(null)
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!reportId) return
    const [reportData, hostList, profileList] = await Promise.all([
      window.reportApi.getReport(reportId),
      window.reportApi.listHosts(),
      window.reportApi.listProfiles()
    ])
    setReport(reportData)
    setHosts(hostList)
    setProfiles(profileList)
    if (reportData?.lastResult) {
      setResult(reportData.lastResult)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!reportId) return
    const unsub = window.reportApi.onProgress((event) => {
      if (event.reportId === reportId) {
        setProgress(event)
      }
    })
    return unsub
  }, [reportId])

  const hostById = useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts])
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const labels = useMemo(
    () => ({
      hostName: (hostId: string) => hostById.get(hostId)?.name ?? hostId,
      profileName: (profileId: string) => profileById.get(profileId)?.name ?? profileId
    }),
    [hostById, profileById]
  )

  const handleRun = async (): Promise<void> => {
    if (!reportId) return
    setRunning(true)
    setError(null)
    setProgress(null)
    try {
      const runResult = await window.reportApi.run(reportId)
      setResult(runResult)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const handleCopy = async (format: 'text' | 'markdown'): Promise<void> => {
    if (!report || !result) return
    const text =
      format === 'markdown'
        ? formatReportMarkdown(report, result, labels)
        : formatReportText(report, result, labels)
    await window.reportApi.writeClipboard(text)
    setCopyFeedback(format === 'markdown' ? 'Markdown copied' : 'Text copied')
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  const renderRow = (entry: ConnectivityTestHostResult): React.JSX.Element => {
    const host = hostById.get(entry.hostId)
    const profile = profileById.get(entry.profileId)
    const expanded = expandedHostId === entry.hostId

    return (
      <tr key={`${entry.hostId}-${entry.profileId}`} className="border-b border-[#30363d]">
        <td className="px-3 py-2 text-sm text-gray-200">{host?.name ?? entry.hostId}</td>
        <td className="px-3 py-2 text-sm text-gray-400">{profile?.name ?? entry.profileId}</td>
        <td className={`px-3 py-2 text-sm font-medium uppercase ${statusBadge(entry.status)}`}>
          {entry.status}
        </td>
        <td className="px-3 py-2 text-sm text-gray-400">{formatDuration(entry.durationMs)}</td>
        <td className="px-3 py-2 text-sm">
          {(entry.error || (entry.log && entry.log.length > 0)) && (
            <button
              type="button"
              onClick={() => setExpandedHostId(expanded ? null : entry.hostId)}
              className="text-xs text-blue-400 hover:underline"
            >
              {expanded ? 'Hide' : 'Show log'}
            </button>
          )}
        </td>
      </tr>
    )
  }

  if (!reportId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        Missing report ID
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading report…
      </div>
    )
  }

  const progressPercent =
    progress && progress.total > 0 ? Math.round(((progress.index + 1) / progress.total) * 100) : 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1117] text-gray-100">
      <header className="shrink-0 border-b border-[#30363d] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{report.name}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Connectivity test · {report.config.entries.length} host
              {report.config.entries.length === 1 ? '' : 's'}
              {report.lastRunAt && (
                <> · Last run: {new Date(report.lastRunAt).toLocaleString()}</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!result}
              onClick={() => void handleCopy('text')}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-40"
            >
              Copy text
            </button>
            <button
              type="button"
              disabled={!result}
              onClick={() => void handleCopy('markdown')}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] disabled:opacity-40"
            >
              Copy MD
            </button>
            <button
              type="button"
              disabled={running || report.config.entries.length === 0}
              onClick={() => void handleRun()}
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
                Testing {labels.hostName(progress.hostId)} ({progress.index + 1}/{progress.total})
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

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!result ? (
          <p className="text-sm text-gray-500">
            No results yet. Click "Generate" to run the connectivity test.
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#30363d] text-xs uppercase text-gray-500">
                <th className="px-3 py-2 font-medium">Host</th>
                <th className="px-3 py-2 font-medium">Profile</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <Fragment key={`${entry.hostId}-${entry.profileId}`}>
                  {renderRow(entry)}
                  {expandedHostId === entry.hostId && (entry.error || entry.log) && (
                    <tr className="bg-[#161b22]">
                      <td colSpan={5} className="px-3 py-2">
                        {entry.error && (
                          <p className="mb-1 text-xs text-red-400">ERROR: {entry.error}</p>
                        )}
                        {entry.log && entry.log.length > 0 && (
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-gray-400">
                            {entry.log.join('\n')}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
