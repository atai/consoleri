import type { BrowserWindow } from 'electron'
import { isOperationalError } from '../errors/OperationalError'
import { openLogWindow } from '../windows/LogWindow'

export async function withOperationalLogWindow<T>(
  getWindow: () => BrowserWindow | null,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (isOperationalError(error)) {
      openLogWindow(error.logId, getWindow())
    }
    throw error
  }
}
