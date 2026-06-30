import { nanoid } from 'nanoid'
import type { LogLevel } from '../../shared/types'
import { OperationalError } from '../errors/OperationalError'
import { connectionLog } from '../sessions/ConnectionLog'
import { sessionManager } from '../sessions/SessionManager'
import { registerLogContext, type LogWindowContext } from '../windows/LogWindow'

export interface OperationLogHandle {
  logId: string
  log: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void
  fail: (message: string, cause?: unknown) => never
}

export function beginOperationLog(context: LogWindowContext): OperationLogHandle {
  const logId = nanoid()
  connectionLog.setSessionVerbosity(logId, 'verbose')
  registerLogContext(logId, context)

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    sessionManager.appendOperationLog(logId, level, message, meta)
  }

  return {
    logId,
    log,
    fail: (message: string, cause?: unknown): never => {
      const detail = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
      log('error', detail ? `${message}: ${detail}` : message)
      throw new OperationalError(message, logId, { cause })
    }
  }
}
