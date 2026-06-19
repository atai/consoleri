import { describe, expect, it } from 'vitest'
import { buildHostsExportDocument } from './export'
import { fixedExportedAt, sampleGroup, sampleHost, sampleHost2, sampleProfile } from './fixtures'
import { parseHostsImportJson } from './import'
import {
  groupCreateFromExportItem,
  hostCreateFromExportItem,
  hostRelationPatchFromExportItem,
  profileCreateFromExportItem,
  remapExportId,
  remapExportIds,
  resolveHostProfileLink,
  resolveUxProfileIdForImport
} from './plan'
import type { HostExportItem } from './types'

describe('hostBundle plan', () => {
  const groupIdMap = new Map([['g1', 'new-g1']])
  const hostIdMap = new Map([
    ['h1', 'new-h1'],
    ['h2', 'new-h2'],
    ['h3', 'new-h3']
  ])
  const profileIdMap = new Map([['p1', 'new-p1']])
  const validUxProfileIds = new Set(['ux1', 'builtin-github-dark'])

  describe('remapExportId', () => {
    it('maps known export ids', () => {
      expect(remapExportId('h1', hostIdMap)).toBe('new-h1')
    })

    it('returns null for unknown or empty ids', () => {
      expect(remapExportId('missing', hostIdMap)).toBeNull()
      expect(remapExportId(null, hostIdMap)).toBeNull()
    })
  })

  describe('remapExportIds', () => {
    it('maps and filters unknown ids', () => {
      expect(remapExportIds(['h1', 'h2', 'missing'], hostIdMap)).toEqual(['new-h1', 'new-h2'])
    })
  })

  describe('resolveUxProfileIdForImport', () => {
    it('keeps valid ux profile ids', () => {
      expect(resolveUxProfileIdForImport('ux1', validUxProfileIds)).toBe('ux1')
    })

    it('nulls unknown ux profile ids', () => {
      expect(resolveUxProfileIdForImport('missing', validUxProfileIds)).toBeNull()
      expect(resolveUxProfileIdForImport(null, validUxProfileIds)).toBeNull()
    })
  })

  describe('groupCreateFromExportItem', () => {
    it('remaps parent group id', () => {
      const planned = groupCreateFromExportItem(
        { exportId: 'child', name: 'Child', parentId: 'g1', sortOrder: 2 },
        groupIdMap
      )
      expect(planned).toEqual({
        exportId: 'child',
        name: 'Child',
        parentId: 'new-g1',
        sortOrder: 2
      })
    })
  })

  describe('hostCreateFromExportItem', () => {
    it('remaps group id and validates ux profile', () => {
      const hostItem = {
        ...buildHostsExportDocument([], [sampleHost], [], [], fixedExportedAt).hosts[0]!
      }
      const planned = hostCreateFromExportItem(hostItem, groupIdMap, validUxProfileIds)
      expect(planned.exportId).toBe('h1')
      expect(planned.input.groupId).toBe('new-g1')
      expect(planned.input.uxProfileId).toBe('ux1')
      expect(planned.input.relatedHostIds).toBeUndefined()
    })

    it('nulls unknown ux profile id', () => {
      const hostItem: HostExportItem = {
        ...buildHostsExportDocument([], [sampleHost], [], [], fixedExportedAt).hosts[0]!,
        uxProfileId: 'missing'
      }
      const planned = hostCreateFromExportItem(hostItem, groupIdMap, validUxProfileIds)
      expect(planned.input.uxProfileId).toBeNull()
    })
  })

  describe('hostRelationPatchFromExportItem', () => {
    it('remaps host and profile relations', () => {
      const hostItem = buildHostsExportDocument([], [sampleHost], [], [], fixedExportedAt).hosts[0]!
      const patch = hostRelationPatchFromExportItem(hostItem, hostIdMap, profileIdMap)
      expect(patch).toEqual({
        exportId: 'h1',
        patch: {
          relatedHostIds: ['new-h2'],
          gatewayHostId: 'new-h3',
          defaultProfileId: 'new-p1'
        }
      })
    })

    it('returns null when there is nothing to patch', () => {
      const hostItem = buildHostsExportDocument([], [sampleHost2], [], [], fixedExportedAt).hosts[0]!
      expect(hostRelationPatchFromExportItem(hostItem, hostIdMap, profileIdMap)).toBeNull()
    })
  })

  describe('profileCreateFromExportItem', () => {
    it('remaps jump host id', () => {
      const profileItem = buildHostsExportDocument(
        [],
        [],
        [sampleProfile],
        [],
        fixedExportedAt
      ).profiles[0]!
      const planned = profileCreateFromExportItem(profileItem, hostIdMap)
      expect(planned.exportId).toBe('p1')
      expect(planned.input.jumpHostId).toBe('new-h2')
      expect(planned.input.username).toBe('deploy')
      expect(planned.input.credentialRef).toBe('keyfile:/home/u/.ssh/id_rsa')
    })
  })

  describe('resolveHostProfileLink', () => {
    it('resolves links when both ids are known', () => {
      expect(resolveHostProfileLink({ hostId: 'h1', profileId: 'p1' }, hostIdMap, profileIdMap)).toEqual({
        hostId: 'new-h1',
        profileId: 'new-p1'
      })
    })

    it('returns null when either id is unknown', () => {
      expect(resolveHostProfileLink({ hostId: 'h1', profileId: 'missing' }, hostIdMap, profileIdMap)).toBeNull()
    })
  })
})

describe('hostBundle round-trip', () => {
  it('export document survives JSON serialize and parse', () => {
    const exported = buildHostsExportDocument(
      [sampleGroup],
      [sampleHost, sampleHost2],
      [sampleProfile],
      [{ hostId: 'h1', profileId: 'p1' }],
      fixedExportedAt
    )
    const imported = parseHostsImportJson(JSON.stringify(exported))
    expect(imported).toEqual(exported)
  })
})
