import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import { parseWslListOutput, resolveLocalShell } from '@consoleri/core'
import type { WslDistro } from '../../shared/types'

const execFileAsync = promisify(execFile)

export async function listWslDistros(): Promise<WslDistro[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync('wsl.exe', ['-l', '-v'], { encoding: 'utf16le' })
    return parseWslListOutput(stdout)
  } catch {
    return []
  }
}

export { resolveLocalShell }

export function resolveLocalShellSpawn(
  shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
  wslDistro?: string,
  wslShell = '/bin/bash'
): { file: string; args: string[]; cwd?: string } {
  return resolveLocalShell({
    shell,
    wslDistro,
    wslShell,
    platform: process.platform,
    existsSync,
    homeDir: process.env.HOME ?? process.env.USERPROFILE
  })
}
