import { nanoid } from 'nanoid'
import { normalizeConnectivityTestResult, normalizeReportConfig } from '@consoleri/core'
import type {
  ConnectivityTestResult,
  Report,
  ReportInput,
  ReportType
} from '@consoleri/core'
import { getDatabase } from '../db/database'

function rowToReport(row: Record<string, unknown>): Report {
  const type = row.type as ReportType
  const config = normalizeReportConfig(type, JSON.parse((row.config_json as string) || '{}'))
  const lastResultRaw = row.last_result_json as string | null
  let lastResult: ConnectivityTestResult | null = null
  if (lastResultRaw) {
    try {
      lastResult = normalizeConnectivityTestResult(JSON.parse(lastResultRaw))
    } catch {
      lastResult = null
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    type,
    config,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    lastResult,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export class ReportRepository {
  list(): Report[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM reports ORDER BY updated_at DESC, name COLLATE NOCASE')
      .all()
    return rows.map((row) => rowToReport(row as Record<string, unknown>))
  }

  get(id: string): Report | null {
    const row = getDatabase().prepare('SELECT * FROM reports WHERE id = ?').get(id)
    return row ? rowToReport(row as Record<string, unknown>) : null
  }

  create(input: ReportInput): Report {
    const id = nanoid()
    const now = new Date().toISOString()
    const config = normalizeReportConfig(input.type, input.config)
    getDatabase()
      .prepare(
        `INSERT INTO reports (id, name, type, config_json, last_run_at, last_result_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`
      )
      .run(id, input.name.trim(), input.type, JSON.stringify(config), now, now)
    return this.get(id)!
  }

  update(id: string, patch: Partial<ReportInput>): Report {
    const existing = this.get(id)
    if (!existing) throw new Error(`Report not found: ${id}`)

    const name = patch.name?.trim() ?? existing.name
    const type = patch.type ?? existing.type
    const config = patch.config ? normalizeReportConfig(type, patch.config) : existing.config
    const now = new Date().toISOString()

    getDatabase()
      .prepare(
        `UPDATE reports SET name = ?, type = ?, config_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(name, type, JSON.stringify(config), now, id)

    return this.get(id)!
  }

  delete(id: string): void {
    getDatabase().prepare('DELETE FROM reports WHERE id = ?').run(id)
  }

  saveResult(id: string, result: ConnectivityTestResult): Report {
    const existing = this.get(id)
    if (!existing) throw new Error(`Report not found: ${id}`)

    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `UPDATE reports SET last_run_at = ?, last_result_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(result.runAt, JSON.stringify(result), now, id)

    return this.get(id)!
  }
}

export const reportRepository = new ReportRepository()
