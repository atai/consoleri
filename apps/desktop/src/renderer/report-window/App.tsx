import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatReportMarkdown, formatReportText } from '@consoleri/core'
import type {
  ConnectionProfile,
  Host,
  Report,
  ReportProgressEvent,
  ReportResult
} from '@shared/types'
import { ConnectivityResultsTable } from './ConnectivityResultsTable'
import { InventoryResultsTable } from './InventoryResultsTable'
import { ReportWindowShell } from './ReportWindowShell'

declare global {
  interface Window {
    reportApi: {
      getReportId: () => string
      getReport: (reportId: string) => Promise<Report | null>
      run: (reportId: string) => Promise<ReportResult>
      onProgress: (cb: (event: ReportProgressEvent) => void) => () => void
      writeClipboard: (text: string) => Promise<void>
      listHosts: () => Promise<Host[]>
      listProfiles: (hostId?: string) => Promise<ConnectionProfile[]>
    }
  }
}

function emptyResultMessage(type: Report['type']): string {
  switch (type) {
    case 'connectivity_test':
      return 'No results yet. Click "Generate" to run the connectivity test.'
    case 'inventory':
      return 'No results yet. Click "Generate" to collect inventory data.'
    default:
      return 'No results yet. Click "Generate" to run the report.'
  }
}

export function ReportWindowApp(): React.JSX.Element {
  const reportId = window.reportApi.getReportId()
  const [report, setReport] = useState<Report | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [hosts, setHosts] = useState<Host[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ReportProgressEvent | null>(null)
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

  const renderResults = (): React.JSX.Element => {
    if (!result) {
      return <p className="text-sm text-gray-500">{emptyResultMessage(report.type)}</p>
    }

    switch (result.type) {
      case 'connectivity_test':
        return (
          <ConnectivityResultsTable
            result={result}
            hostName={labels.hostName}
            profileName={labels.profileName}
          />
        )
      case 'inventory':
        return (
          <InventoryResultsTable
            result={result}
            hostName={labels.hostName}
            profileName={labels.profileName}
          />
        )
      default:
        return <p className="text-sm text-gray-500">Unsupported report type.</p>
    }
  }

  return (
    <ReportWindowShell
      report={report}
      result={result}
      running={running}
      progress={progress}
      error={error}
      copyFeedback={copyFeedback}
      canCopy={result !== null}
      canRun={report.config.entries.length > 0}
      labels={labels}
      onRun={() => void handleRun()}
      onCopyText={() => void handleCopy('text')}
      onCopyMarkdown={() => void handleCopy('markdown')}
    >
      {renderResults()}
    </ReportWindowShell>
  )
}
