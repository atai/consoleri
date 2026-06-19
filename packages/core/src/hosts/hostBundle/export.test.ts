import { describe, expect, it } from 'vitest'
import type { ConnectionProfile } from '../../types'
import {
  buildHostsExportDocument,
  groupToExportItem,
  hostToExportItem,
  profileToExportItem,
  sanitizeCredentialRefForExport,
  serializeHostsExportDocument
} from './export'
import { fixedExportedAt, sampleGroup, sampleHost, sampleProfile } from './fixtures'
import { HOSTS_BUNDLE_VERSION } from './types'

describe('hostBundle export', () => {
  describe('sanitizeCredentialRefForExport', () => {
    it('keeps keyfile refs', () => {
      expect(sanitizeCredentialRefForExport('keyfile:C:/Users/u/.ssh/id_rsa')).toBe(
        'keyfile:C:/Users/u/.ssh/id_rsa'
      )
    })

    it('strips vault profile refs', () => {
      expect(sanitizeCredentialRefForExport('profile:p1:password')).toBeNull()
      expect(sanitizeCredentialRefForExport('profile:p1:key')).toBeNull()
    })

    it('returns null for empty ref', () => {
      expect(sanitizeCredentialRefForExport(null)).toBeNull()
    })
  })

  describe('hostToExportItem', () => {
    it('omits runtime fields', () => {
      const item = hostToExportItem(sampleHost)
      expect(item.exportId).toBe('h1')
      expect(item).not.toHaveProperty('id')
      expect(item).not.toHaveProperty('createdAt')
      expect(item).not.toHaveProperty('updatedAt')
    })

    it('covers all Host data fields', () => {
      const item = hostToExportItem(sampleHost)
      const runtimeKeys = new Set(['id', 'createdAt', 'updatedAt'])
      const hostKeys = Object.keys(sampleHost).filter((k) => !runtimeKeys.has(k))
      const exportKeys = Object.keys(item).filter((k) => k !== 'exportId')
      expect(new Set(exportKeys)).toEqual(new Set(hostKeys))
    })
  })

  describe('profileToExportItem', () => {
    it('sanitizes vault credentials but keeps username', () => {
      const vaultProfile: ConnectionProfile = {
        ...sampleProfile,
        credentialRef: 'profile:p1:password'
      }
      const item = profileToExportItem(vaultProfile)
      expect(item.credentialRef).toBeNull()
      expect(item.username).toBe('deploy')
      expect(item.authMethod).toBe('key')
    })

    it('covers all ConnectionProfile data fields', () => {
      const item = profileToExportItem(sampleProfile)
      const profileKeys = Object.keys(sampleProfile).filter((k) => k !== 'id')
      const exportKeys = Object.keys(item).filter((k) => k !== 'exportId')
      expect(new Set(exportKeys)).toEqual(new Set(profileKeys))
    })
  })

  describe('groupToExportItem', () => {
    it('maps id to exportId', () => {
      expect(groupToExportItem(sampleGroup)).toEqual({
        exportId: 'g1',
        name: 'Prod',
        parentId: null,
        sortOrder: 1
      })
    })
  })

  describe('buildHostsExportDocument', () => {
    it('builds a versioned document with all sections', () => {
      const doc = buildHostsExportDocument(
        [sampleGroup],
        [sampleHost],
        [sampleProfile],
        [{ hostId: 'h1', profileId: 'p1' }],
        fixedExportedAt
      )
      expect(doc).toEqual({
        version: HOSTS_BUNDLE_VERSION,
        exportedAt: fixedExportedAt,
        groups: [groupToExportItem(sampleGroup)],
        hosts: [hostToExportItem(sampleHost)],
        profiles: [profileToExportItem(sampleProfile)],
        links: [{ hostId: 'h1', profileId: 'p1' }]
      })
    })
  })

  describe('serializeHostsExportDocument', () => {
    it('produces pretty-printed JSON with trailing newline', () => {
      const doc = buildHostsExportDocument([], [sampleHost], [], [], fixedExportedAt)
      const serialized = serializeHostsExportDocument(doc)
      expect(serialized.endsWith('\n')).toBe(true)
      expect(JSON.parse(serialized)).toMatchObject({ version: HOSTS_BUNDLE_VERSION })
    })
  })
})
