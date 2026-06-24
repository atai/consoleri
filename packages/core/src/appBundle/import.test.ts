import { describe, expect, it } from 'vitest'
import { isAppExportDocument, normalizeAppExportDocument, parseAppImportJson } from './import'
import { APP_BUNDLE_KIND, APP_BUNDLE_VERSION } from './types'

const minimalDoc = {
  kind: APP_BUNDLE_KIND,
  version: APP_BUNDLE_VERSION,
  exportedAt: '2026-01-01T00:00:00.000Z',
  settings: {
    app: { autoOpenConnectionLog: false, sessionOpenMode: 'workspace' },
    hostListView: { version: 1, groupBy: 'none', selectedTags: [], selectedGroupId: 'all', selectedHostId: null, collapsedSections: [], sortBy: 'name', sortDir: 'asc' },
    mapView: { version: 1, appView: 'list', mapMode: 'logical' },
    vault: { enabled: false, address: '', namespace: '', defaultKvMount: 'secret', secretPathPrefix: 'consoleri', defaultBackend: 'local', auth: { method: 'token', hasToken: false }, tlsSkipVerify: false },
    activeUxProfileId: null,
    uxProfiles: []
  },
  secrets: [],
  hosts: { version: 1, exportedAt: '2026-01-01T00:00:00.000Z', groups: [], hosts: [], profiles: [], links: [] },
  reports: [],
  workspace: null
}

describe('appBundle import', () => {
  describe('isAppExportDocument', () => {
    it('returns true for valid app bundle', () => {
      expect(isAppExportDocument(minimalDoc)).toBe(true)
    })

    it('returns false for hosts-only document', () => {
      expect(isAppExportDocument({ version: 1, groups: [], hosts: [] })).toBe(false)
    })

    it('returns false for non-object', () => {
      expect(isAppExportDocument('not an object')).toBe(false)
    })
  })

  describe('normalizeAppExportDocument', () => {
    it('accepts a valid minimal document', () => {
      const doc = normalizeAppExportDocument(minimalDoc)
      expect(doc.kind).toBe(APP_BUNDLE_KIND)
      expect(doc.version).toBe(1)
      expect(doc.reports).toEqual([])
      expect(doc.workspace).toBeNull()
    })

    it('filters invalid report entries', () => {
      const withBadReport = { ...minimalDoc, reports: [{ bad: 'data' }, { exportId: 'r1', name: 'Test', type: 'connectivity_test', config: { type: 'connectivity_test', entries: [] }, lastRunAt: null, lastResult: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] }
      const doc = normalizeAppExportDocument(withBadReport)
      expect(doc.reports).toHaveLength(1)
      expect(doc.reports[0].exportId).toBe('r1')
    })

    it('normalizes workspace panes', () => {
      const withWorkspace = {
        ...minimalDoc,
        workspace: {
          name: 'Default',
          layout: null,
          panes: [{ paneId: 'pane1', connectRequest: { hostId: 'h1' } }]
        }
      }
      const doc = normalizeAppExportDocument(withWorkspace)
      expect(doc.workspace?.panes).toHaveLength(1)
    })

    it('throws for wrong kind', () => {
      expect(() => normalizeAppExportDocument({ ...minimalDoc, kind: 'other' })).toThrow()
    })

    it('throws for wrong version', () => {
      expect(() => normalizeAppExportDocument({ ...minimalDoc, version: 2 })).toThrow()
    })

    it('throws for non-object', () => {
      expect(() => normalizeAppExportDocument(null)).toThrow()
    })

    it('filters invalid secret entries', () => {
      const withSecrets = {
        ...minimalDoc,
        secrets: [
          { ref: 'vault:auth:token', encryptedBlob: 'abc==' },
          { ref: 123, encryptedBlob: 'bad' }  // invalid
        ]
      }
      const doc = normalizeAppExportDocument(withSecrets)
      expect(doc.secrets).toHaveLength(1)
    })
  })

  describe('parseAppImportJson', () => {
    it('parses valid JSON string', () => {
      const json = JSON.stringify(minimalDoc)
      const doc = parseAppImportJson(json)
      expect(doc.kind).toBe(APP_BUNDLE_KIND)
    })

    it('throws on invalid JSON', () => {
      expect(() => parseAppImportJson('not json')).toThrow('Invalid JSON')
    })
  })
})
