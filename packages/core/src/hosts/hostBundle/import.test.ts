import { describe, expect, it } from 'vitest'
import { buildHostsExportDocument } from './export'
import { fixedExportedAt, sampleGroup, sampleHost, sampleProfile } from './fixtures'
import {
  legacyHostsArrayToDocument,
  normalizeGroupExportItem,
  normalizeHostExportItem,
  normalizeHostsExportDocument,
  normalizeLinkExportItem,
  normalizeProfileExportItem,
  parseHostsImportJson,
  parseHostsImportPayload,
  sanitizeCredentialRefForImport,
  sortGroupsForImport
} from './import'

describe('hostBundle import', () => {
  describe('normalizeHostExportItem', () => {
    it('normalizes a full host entry', () => {
      const item = normalizeHostExportItem({
        exportId: 'h1',
        name: 'web-01',
        hostname: '10.0.0.1',
        port: 2222,
        osType: 'linux',
        tags: ['prod'],
        notes: 'note',
        logVerbosity: 'verbose',
        relatedHostIds: ['h2'],
        gatewayHostId: 'h3',
        httpEndpoint: 'https://10.0.0.1'
      })
      expect(item).toMatchObject({
        exportId: 'h1',
        port: 2222,
        logVerbosity: 'verbose',
        relatedHostIds: ['h2']
      })
    })

    it('generates exportId for legacy entries', () => {
      const item = normalizeHostExportItem({ name: 'web-01', hostname: '10.0.0.1', port: 22 })
      expect(item?.exportId).toBe('10.0.0.1:22')
    })

    it('rejects invalid http endpoint', () => {
      expect(
        normalizeHostExportItem({ name: 'web', hostname: '10.0.0.1', httpEndpoint: 'not-a-url' })
      ).toBeNull()
    })

    it('rejects entries without required fields', () => {
      expect(normalizeHostExportItem({ name: 'web' })).toBeNull()
    })
  })

  describe('normalizeProfileExportItem', () => {
    it('keeps keyfile credential refs', () => {
      const item = normalizeProfileExportItem({
        exportId: 'p1',
        name: 'SSH',
        credentialRef: 'keyfile:/home/u/.ssh/id_rsa',
        username: 'deploy'
      })
      expect(item?.credentialRef).toBe('keyfile:/home/u/.ssh/id_rsa')
      expect(item?.username).toBe('deploy')
    })

    it('strips vault credential refs on import', () => {
      const item = normalizeProfileExportItem({
        exportId: 'p1',
        name: 'SSH',
        credentialRef: 'profile:p1:password'
      })
      expect(item?.credentialRef).toBeNull()
    })
  })

  describe('sanitizeCredentialRefForImport', () => {
    it('mirrors export sanitization rules', () => {
      expect(sanitizeCredentialRefForImport('keyfile:/x')).toBe('keyfile:/x')
      expect(sanitizeCredentialRefForImport('profile:p1:key')).toBeNull()
    })
  })

  describe('normalizeGroupExportItem', () => {
    it('normalizes group entries', () => {
      expect(
        normalizeGroupExportItem({ exportId: 'g1', name: 'Prod', parentId: 'g0', sortOrder: 2 })
      ).toEqual({
        exportId: 'g1',
        name: 'Prod',
        parentId: 'g0',
        sortOrder: 2
      })
    })

    it('rejects invalid groups', () => {
      expect(normalizeGroupExportItem({ name: 'Prod' })).toBeNull()
    })
  })

  describe('normalizeLinkExportItem', () => {
    it('normalizes host-profile links', () => {
      expect(normalizeLinkExportItem({ hostId: 'h1', profileId: 'p1' })).toEqual({
        hostId: 'h1',
        profileId: 'p1'
      })
    })

    it('rejects incomplete links', () => {
      expect(normalizeLinkExportItem({ hostId: 'h1' })).toBeNull()
    })
  })

  describe('legacyHostsArrayToDocument', () => {
    it('wraps legacy host arrays', () => {
      const doc = legacyHostsArrayToDocument(
        [{ name: 'web-01', hostname: '10.0.0.1' }],
        fixedExportedAt
      )
      expect(doc.hosts).toHaveLength(1)
      expect(doc.groups).toEqual([])
      expect(doc.exportedAt).toBe(fixedExportedAt)
    })

    it('throws when no valid hosts remain', () => {
      expect(() => legacyHostsArrayToDocument([{ bad: true }])).toThrow(
        /No valid hosts in import data/
      )
    })
  })

  describe('normalizeHostsExportDocument', () => {
    it('filters invalid entries but keeps valid ones', () => {
      const doc = normalizeHostsExportDocument({
        version: 1,
        hosts: [{ name: 'ok', hostname: '10.0.0.1' }, { name: 'bad' }],
        profiles: [{ exportId: 'p1', name: 'SSH' }]
      })
      expect(doc.hosts).toHaveLength(1)
      expect(doc.profiles).toHaveLength(1)
    })

    it('throws for empty documents', () => {
      expect(() => normalizeHostsExportDocument({ version: 1, hosts: [] })).toThrow(/empty/)
    })

    it('throws for non-objects', () => {
      expect(() => normalizeHostsExportDocument(null)).toThrow(/Invalid hosts export document/)
    })
  })

  describe('parseHostsImportJson', () => {
    it('parses legacy host array JSON', () => {
      const doc = parseHostsImportJson('[{"name":"web-01","hostname":"10.0.0.1"}]')
      expect(doc.hosts).toHaveLength(1)
    })

    it('parses full bundle JSON', () => {
      const bundle = buildHostsExportDocument(
        [sampleGroup],
        [sampleHost],
        [sampleProfile],
        [{ hostId: 'h1', profileId: 'p1' }],
        fixedExportedAt
      )
      const doc = parseHostsImportJson(JSON.stringify(bundle))
      expect(doc.hosts).toHaveLength(1)
      expect(doc.profiles).toHaveLength(1)
      expect(doc.links).toHaveLength(1)
      expect(doc.groups).toHaveLength(1)
    })

    it('rejects invalid JSON', () => {
      expect(() => parseHostsImportJson('{')).toThrow(/Invalid JSON/)
    })
  })

  describe('parseHostsImportPayload', () => {
    it('accepts string, array, and object payloads', () => {
      expect(parseHostsImportPayload([{ name: 'a', hostname: '1.1.1.1' }]).hosts).toHaveLength(1)
      expect(
        parseHostsImportPayload({ hosts: [{ name: 'a', hostname: '1.1.1.1' }] }).hosts
      ).toHaveLength(1)
      expect(
        parseHostsImportPayload('[{"name":"a","hostname":"1.1.1.1"}]').hosts
      ).toHaveLength(1)
    })
  })

  describe('sortGroupsForImport', () => {
    it('orders parents before children', () => {
      const sorted = sortGroupsForImport([
        { exportId: 'child', name: 'Child', parentId: 'parent', sortOrder: 0 },
        { exportId: 'parent', name: 'Parent', parentId: null, sortOrder: 0 }
      ])
      expect(sorted.map((g) => g.exportId)).toEqual(['parent', 'child'])
    })

    it('handles three-level hierarchy', () => {
      const sorted = sortGroupsForImport([
        { exportId: 'grandchild', name: 'GC', parentId: 'child', sortOrder: 0 },
        { exportId: 'child', name: 'Child', parentId: 'parent', sortOrder: 0 },
        { exportId: 'parent', name: 'Parent', parentId: null, sortOrder: 0 }
      ])
      expect(sorted.map((g) => g.exportId)).toEqual(['parent', 'child', 'grandchild'])
    })
  })
})
