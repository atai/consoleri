import { describe, expect, it } from 'vitest'
import type { Host, SshKeyInfo } from '@shared/types'
import { suggestProfileName } from './profileDisplay'

const hosts: Host[] = [
  {
    id: 'bastion-1',
    name: 'Bastion',
    hostname: 'bastion.example.com',
    port: 22,
    osType: 'linux',
    tags: [],
    groupId: null,
    notes: '',
    defaultProfileId: null,
    uxProfileId: null,
    logVerbosity: 'info',
    relatedHostIds: [],
    gatewayHostId: null,
    httpEndpoint: null,
    createdAt: '',
    updatedAt: ''
  }
]

const sshKeys: SshKeyInfo[] = [
  {
    id: 'key-1',
    label: 'Work Key',
    privateKeyPath: '/home/user/.ssh/work_key',
    publicKeyPath: '/home/user/.ssh/work_key.pub',
    fingerprint: null,
    keyType: 'ed25519',
    encrypted: false,
    source: 'custom',
    exists: true
  }
]

describe('suggestProfileName', () => {
  it('builds name with username, protocol, and auth method', () => {
    expect(
      suggestProfileName({
        username: 'admin',
        protocol: 'ssh',
        authMethod: 'password',
        jumpHostId: '',
        hosts
      })
    ).toBe('admin (ssh - password)')
  })

  it('includes jump host name when selected for ssh', () => {
    expect(
      suggestProfileName({
        username: 'admin',
        protocol: 'ssh',
        authMethod: 'key',
        jumpHostId: 'bastion-1',
        hosts,
        selectedKeyPath: '/home/user/.ssh/work_key',
        sshKeys
      })
    ).toBe('admin (ssh - Work Key - Bastion)')
  })

  it('uses ssh key label when auth method is key', () => {
    expect(
      suggestProfileName({
        username: 'admin',
        protocol: 'ssh',
        authMethod: 'key',
        jumpHostId: '',
        hosts,
        selectedKeyPath: '/home/user/.ssh/work_key',
        sshKeys
      })
    ).toBe('admin (ssh - Work Key)')
  })

  it('uses vault local label for pasted private key', () => {
    expect(
      suggestProfileName({
        username: 'admin',
        protocol: 'ssh',
        authMethod: 'key',
        jumpHostId: '',
        hosts,
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----'
      })
    ).toBe('admin (ssh - vault local)')
  })

  it('uses vault hc label when vault backend selected', () => {
    expect(
      suggestProfileName({
        username: 'admin',
        protocol: 'ssh',
        authMethod: 'key',
        jumpHostId: '',
        hosts,
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
        secretBackend: 'vault'
      })
    ).toBe('admin (ssh - vault hc)')
  })

  it('uses noname when username is empty', () => {
    expect(
      suggestProfileName({
        username: '',
        protocol: 'ssh',
        authMethod: 'password',
        jumpHostId: '',
        hosts
      })
    ).toBe('noname (ssh - password)')
  })

  it('uses none auth for protocols without auth support', () => {
    expect(
      suggestProfileName({
        username: '',
        protocol: 'wsl',
        authMethod: 'password',
        jumpHostId: '',
        hosts
      })
    ).toBe('noname (wsl - none)')
  })
})
