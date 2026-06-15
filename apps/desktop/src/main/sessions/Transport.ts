import { EventEmitter } from 'events'

export interface TransportEvents {
  data: (data: string) => void
  exit: (code: number, signal?: number) => void
  error: (err: Error) => void
}

export interface ITransport extends EventEmitter {
  write(data: string): void
  resize(cols: number, rows: number): void
  disconnect(): void
  readonly protocol: string
}

export abstract class BaseTransport extends EventEmitter implements ITransport {
  abstract readonly protocol: string

  write(_data: string): void {
    /* subclass */
  }

  resize(_cols: number, _rows: number): void {
    /* subclass */
  }

  disconnect(): void {
    /* subclass */
  }
}
