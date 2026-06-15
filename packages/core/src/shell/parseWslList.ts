import type { WslDistro } from '../types'

export function parseWslListOutput(stdout: string): WslDistro[] {
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
}
