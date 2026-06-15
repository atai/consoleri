import { describe, expect, it } from 'vitest'
import { rowToHost, rowToProfile } from './mappers'

describe('rowToHost', () => {
  it('maps database row to Host', () => {
    const host = rowToHost({
      id: 'h1',
      name: 'web',
      hostname: '10.0.0.1',
      port: 22,
      os_type: 'linux',
      tags_json: '["prod"]',
      group_id: null,
      notes: 'note',
      default_profile_id: null,
      ux_profile_id: null,
      log_verbosity: 'info',
      related_hosts_json: '["db"]',
      gateway_host_id: 'gw1',
      created_at: '2024-01-01',
      updated_at: '2024-01-02'
    })
    expect(host.name).toBe('web')
    expect(host.tags).toEqual(['prod'])
    expect(host.logVerbosity).toBe('info')
    expect(host.relatedHostIds).toEqual(['db'])
    expect(host.gatewayHostId).toBe('gw1')
  })
})

describe('rowToProfile', () => {
  it('maps database row to ConnectionProfile', () => {
    const profile = rowToProfile({
      id: 'p1',
      host_id: 'h1',
      name: 'SSH',
      protocol: 'ssh',
      shell: '/bin/bash',
      username: 'root',
      auth_method: 'password',
      credential_ref: 'profile:p1:password',
      jump_host_id: null,
      extra_json: '{}'
    })
    expect(profile.protocol).toBe('ssh')
    expect(profile.shell).toBe('/bin/bash')
  })
})
