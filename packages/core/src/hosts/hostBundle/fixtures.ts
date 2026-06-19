import type { ConnectionProfile, Host } from '../../types'
import type { HostGroupLike } from './types'

export const sampleHost: Host = {
  id: 'h1',
  name: 'web-01',
  hostname: '10.0.0.1',
  port: 22,
  osType: 'linux',
  tags: ['prod'],
  groupId: 'g1',
  notes: 'note',
  defaultProfileId: 'p1',
  uxProfileId: 'ux1',
  logVerbosity: 'info',
  relatedHostIds: ['h2'],
  gatewayHostId: 'h3',
  httpEndpoint: 'https://10.0.0.1/',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02'
}

export const sampleHost2: Host = {
  ...sampleHost,
  id: 'h2',
  name: 'db-01',
  hostname: '10.0.0.2',
  relatedHostIds: [],
  gatewayHostId: null,
  defaultProfileId: null
}

export const sampleProfile: ConnectionProfile = {
  id: 'p1',
  name: 'SSH',
  protocol: 'ssh',
  shell: '/bin/bash',
  username: 'deploy',
  authMethod: 'key',
  credentialRef: 'keyfile:/home/u/.ssh/id_rsa',
  jumpHostId: 'h2',
  extra: { foo: 'bar' }
}

export const sampleGroup: HostGroupLike = {
  id: 'g1',
  name: 'Prod',
  parentId: null,
  sortOrder: 1
}

export const fixedExportedAt = '2026-06-19T12:00:00.000Z'
