import * as pty from 'node-pty'
import { BaseTransport } from './Transport'
import { resolveLocalShell } from './shellUtils'

export class PtySession extends BaseTransport {
  readonly protocol = 'local_pty'
  private proc: pty.IPty | null = null

  constructor(
    shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
    cols: number,
    rows: number,
    wslDistro?: string,
    wslShell?: string
  ) {
    super()
    const { file, args, cwd } = resolveLocalShell(shell, wslDistro, wslShell)
    const env = { ...process.env } as Record<string, string>
    if (process.platform === 'win32' && !env.TERM) {
      env.TERM = 'xterm-256color'
    }

    this.proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd ?? process.env.HOME ?? process.env.USERPROFILE,
      env
    })

    this.proc.onData((data) => this.emit('data', data))
    this.proc.onExit(({ exitCode, signal }) => this.emit('exit', exitCode, signal))
  }

  write(data: string): void {
    this.proc?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.proc?.resize(cols, rows)
  }

  disconnect(): void {
    this.proc?.kill()
    this.proc = null
  }
}
