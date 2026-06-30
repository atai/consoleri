export class OperationalError extends Error {
  readonly logId: string

  constructor(message: string, logId: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OperationalError'
    this.logId = logId
  }
}

export function isOperationalError(error: unknown): error is OperationalError {
  return error instanceof OperationalError
}
