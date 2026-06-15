export type OsType = 'windows' | 'linux' | 'macos' | 'unknown'
export type Protocol = 'ssh' | 'local_pty' | 'rdp' | 'vnc' | 'wsl'
export type AuthMethod = 'password' | 'key' | 'none'
export type { HostLogVerbosity } from './logging/verbosity'
import type { HostLogVerbosity } from './logging/verbosity'

export interface Host {
  id: string
  name: string
  hostname: string
  port: number
  osType: OsType
  tags: string[]
  groupId: string | null
  notes: string
  defaultProfileId: string | null
  uxProfileId: string | null
  logVerbosity: HostLogVerbosity
  createdAt: string
  updatedAt: string
}

export interface ConnectionProfile {
  id: string
  name: string
  protocol: Protocol
  shell: string | null
  username: string | null
  authMethod: AuthMethod
  credentialRef: string | null
  jumpHostId: string | null
  extra: Record<string, unknown>
}

export interface WslDistro {
  name: string
  state: string
  version: number
}

export type MosaicNode<T extends string = string> =
  | T
  | MosaicSplitNode<T>
  | MosaicTabsNode<T>

export interface MosaicSplitNode<T extends string = string> {
  type: 'split'
  direction: 'row' | 'column'
  children: MosaicNode<T>[]
  splitPercentages?: number[]
}

export interface MosaicTabsNode<T extends string = string> {
  type: 'tabs'
  tabs: T[]
  activeTab: T
}
