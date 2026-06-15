export type OsType = 'windows' | 'linux' | 'macos' | 'unknown'
export type Protocol = 'ssh' | 'local_pty' | 'rdp' | 'vnc' | 'wsl'
export type AuthMethod = 'password' | 'key' | 'none'

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
  createdAt: string
  updatedAt: string
}

export interface ConnectionProfile {
  id: string
  hostId: string | null
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
}

export interface MosaicTabsNode<T extends string = string> {
  type: 'tabs'
  tabs: T[]
  activeTab: T
}
