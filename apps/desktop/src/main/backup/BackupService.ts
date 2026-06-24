import { shell } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { parseAppImportJson, serializeAppExportDocument } from '@consoleri/core'
import { getDatabase } from '../db/database'
import type { AppImportExportService } from '../settings/AppImportExportService'
import type { BackupInfo, BackupSettings } from '../../shared/types'

const BACKUP_SETTINGS_KEY = 'backup_settings'

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: true,
  maxCount: 10,
  intervalMinutes: 60,
  lastBackupAt: null
}

function isoTimestampToFileSafe(iso: string): string {
  return iso.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function backupFilenameToId(filename: string): string {
  return filename.replace(/\.json$/, '')
}

export class BackupService {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly appIE: AppImportExportService,
    private readonly backupDir: string
  ) {}

  getSettings(): BackupSettings {
    const db = getDatabase()
    const row = db
      .prepare('SELECT value FROM app_preferences WHERE key = ?')
      .get(BACKUP_SETTINGS_KEY) as { value: string } | undefined
    if (!row?.value) return { ...DEFAULT_BACKUP_SETTINGS }
    try {
      const parsed = JSON.parse(row.value) as Partial<BackupSettings>
      return {
        enabled: parsed.enabled ?? DEFAULT_BACKUP_SETTINGS.enabled,
        maxCount: typeof parsed.maxCount === 'number' && parsed.maxCount >= 1
          ? Math.min(parsed.maxCount, 100)
          : DEFAULT_BACKUP_SETTINGS.maxCount,
        intervalMinutes: typeof parsed.intervalMinutes === 'number' && parsed.intervalMinutes >= 5
          ? parsed.intervalMinutes
          : DEFAULT_BACKUP_SETTINGS.intervalMinutes,
        lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null
      }
    } catch {
      return { ...DEFAULT_BACKUP_SETTINGS }
    }
  }

  updateSettings(patch: unknown): BackupSettings {
    const current = this.getSettings()
    const p = patch && typeof patch === 'object' ? patch as Partial<BackupSettings> : {}
    const next: BackupSettings = {
      enabled: typeof p.enabled === 'boolean' ? p.enabled : current.enabled,
      maxCount: typeof p.maxCount === 'number' ? Math.max(1, Math.min(100, p.maxCount)) : current.maxCount,
      intervalMinutes: typeof p.intervalMinutes === 'number' ? Math.max(5, p.intervalMinutes) : current.intervalMinutes,
      lastBackupAt: current.lastBackupAt
    }
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(BACKUP_SETTINGS_KEY, JSON.stringify(next))
    return next
  }

  listBackups(): BackupInfo[] {
    if (!existsSync(this.backupDir)) return []
    const files = readdirSync(this.backupDir)
      .filter((f) => f.startsWith('consoleri-backup-') && f.endsWith('.json'))
    const infos: BackupInfo[] = files.map((filename) => {
      const fullPath = join(this.backupDir, filename)
      const stat = statSync(fullPath)
      return {
        id: backupFilenameToId(filename),
        filename,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size
      }
    })
    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  createBackupNow(): BackupInfo {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true })
    }
    const doc = this.appIE.exportAppBundle()
    const now = new Date().toISOString()
    const safeName = isoTimestampToFileSafe(now)
    const filename = `consoleri-backup-${safeName}.json`
    const fullPath = join(this.backupDir, filename)
    writeFileSync(fullPath, serializeAppExportDocument(doc), 'utf8')

    this.updateLastBackupAt(now)
    this.pruneOldBackups()

    const stat = statSync(fullPath)
    return {
      id: backupFilenameToId(filename),
      filename,
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size
    }
  }

  restoreBackup(id: string): void {
    const filename = `${id}.json`
    const fullPath = join(this.backupDir, filename)
    if (!existsSync(fullPath)) {
      throw new Error(`Backup not found: ${id}`)
    }
    const doc = parseAppImportJson(readFileSync(fullPath, 'utf8'))
    this.appIE.importAppBundleReplace(doc)
  }

  deleteBackup(id: string): void {
    const filename = `${id}.json`
    const fullPath = join(this.backupDir, filename)
    if (existsSync(fullPath)) {
      unlinkSync(fullPath)
    }
  }

  openBackupFolder(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true })
    }
    void shell.openPath(this.backupDir)
  }

  startScheduler(): void {
    this.stopScheduler()
    // Check every minute; actual backup only runs when interval has elapsed.
    this.timer = setInterval(() => {
      void this.maybeRunScheduledBackup()
    }, 60_000)
  }

  stopScheduler(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async maybeRunScheduledBackup(): Promise<void> {
    const settings = this.getSettings()
    if (!settings.enabled) return
    const now = Date.now()
    if (settings.lastBackupAt) {
      const elapsed = now - new Date(settings.lastBackupAt).getTime()
      if (elapsed < settings.intervalMinutes * 60_000) return
    }
    try {
      this.createBackupNow()
    } catch {
      // Silently ignore backup errors to not disturb the app
    }
  }

  private updateLastBackupAt(at: string): void {
    const current = this.getSettings()
    const next = { ...current, lastBackupAt: at }
    getDatabase()
      .prepare(
        `INSERT INTO app_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(BACKUP_SETTINGS_KEY, JSON.stringify(next))
  }

  private pruneOldBackups(): void {
    const settings = this.getSettings()
    const backups = this.listBackups()
    if (backups.length <= settings.maxCount) return
    const toDelete = backups.slice(settings.maxCount)
    for (const b of toDelete) {
      this.deleteBackup(b.id)
    }
  }
}
