import { wrapShellCommandWithPs1 } from './remotePrompt'

export type RemoteShellInvoke =
  | { mode: 'default' }
  | { mode: 'exec'; command: string }

export interface ResolveRemoteShellOptions {
  promptFallback?: boolean
}

const DEFAULT_BASH_COMMAND = '/bin/bash --login -i'

function hasLoginFlag(shell: string): boolean {
  return /(?:^|\s)(?:-l|--login)(?:\s|$)/.test(shell)
}

function hasInteractiveFlag(shell: string): boolean {
  return /(?:^|\s)-i(?:\s|$)/.test(shell)
}

function shellBasename(shellPath: string): string {
  const executable = shellPath.trim().split(/\s+/)[0] ?? shellPath
  const parts = executable.split('/')
  return parts[parts.length - 1] ?? executable
}

const BASH_PS1_SHELLS = new Set(['bash', 'sh', 'zsh', 'ksh', 'dash'])

function supportsBashPs1(shell: string): boolean {
  return BASH_PS1_SHELLS.has(shellBasename(shell))
}

function augmentShellCommand(shell: string): string {
  const trimmed = shell.trim()
  const base = shellBasename(trimmed)
  const flags: string[] = []

  if (base === 'bash') {
    if (!hasLoginFlag(trimmed)) flags.push('--login')
    if (!hasInteractiveFlag(trimmed)) flags.push('-i')
  } else if (base === 'sh') {
    if (!hasLoginFlag(trimmed)) flags.push('-l')
  } else if (base === 'zsh') {
    if (!hasLoginFlag(trimmed)) flags.push('-l')
    if (!hasInteractiveFlag(trimmed)) flags.push('-i')
  } else if (base === 'csh' || base === 'tcsh') {
    if (!hasInteractiveFlag(trimmed)) flags.push('-i')
  }

  if (flags.length === 0) return trimmed
  return `${trimmed} ${flags.join(' ')}`
}

function execCommand(shell: string | null | undefined, promptFallback: boolean): RemoteShellInvoke {
  const trimmed = shell?.trim() ?? ''
  const baseCommand = trimmed ? augmentShellCommand(trimmed) : DEFAULT_BASH_COMMAND
  const command =
    promptFallback && supportsBashPs1(baseCommand)
      ? wrapShellCommandWithPs1(baseCommand)
      : baseCommand
  return { mode: 'exec', command }
}

export function resolveRemoteShellInvoke(
  shell: string | null | undefined,
  options?: ResolveRemoteShellOptions
): RemoteShellInvoke {
  const promptFallback = options?.promptFallback ?? false
  const trimmed = shell?.trim() ?? ''

  if (!trimmed && !promptFallback) {
    return { mode: 'default' }
  }

  return execCommand(shell, promptFallback)
}
