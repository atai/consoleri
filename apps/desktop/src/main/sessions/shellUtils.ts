import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import type { WslDistro } from '../../shared/types'

const execFileAsync = promisify(execFile)

export async function listWslDistros(): Promise<WslDistro[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync('wsl.exe', ['-l', '-v'], { encoding: 'utf16le' })
    const lines = stdout.split('\n').slice(1)
    const distros: WslDistro[] = []
    for (const line of lines) {
      const trimmed = line.replace(/\0/g, '').trim()
      if (!trimmed) continue
      const match = trimmed.match(/^(.+?)\s+(Running|Stopped)\s+(\d+)/)
      if (match) {
        distros.push({
          name: match[1].replace('*', '').trim(),
          state: match[2],
          version: parseInt(match[3], 10)
        })
      }
    }
    return distros
  } catch {
    return []
  }
}

export function resolveLocalShell(
  shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
  wslDistro?: string,
  wslShell = '/bin/bash'
): { file: string; args: string[]; cwd?: string } {
  switch (shell) {
    case 'pwsh':
      return { file: 'pwsh.exe', args: [] }
    case 'powershell':
      return { file: 'powershell.exe', args: [] }
    case 'cmd':
      return { file: 'cmd.exe', args: [] }
    case 'bash': {
      const candidates = [
        process.env.COMSPEC ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '',
        'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        '/bin/bash',
        '/usr/bin/bash'
      ].filter(Boolean)
      const bash = candidates.find((p) => existsSync(p)) ?? 'bash'
      return { file: bash, args: ['--login', '-i'] }
    }
    case 'wsl':
      return {
        file: 'wsl.exe',
        args: wslDistro ? ['-d', wslDistro, '--', wslShell, '-l'] : ['--', wslShell, '-l']
      }
    default:
      return { file: process.platform === 'win32' ? 'powershell.exe' : 'bash', args: [] }
  }
}
