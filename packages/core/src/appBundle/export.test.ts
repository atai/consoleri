import { describe, expect, it } from 'vitest'
import type { AppSettings } from '../types'
import type { HostListViewSettings } from '../hosts/hostListView'
import type { MapViewSettings } from '../map/mapView'
import type { VaultSettings } from '../vault/types'
import type { UxProfile } from '../ux/types'
import type { Report } from '../reports/types'
import { buildHostsExportDocument } from '../hosts/hostBundle/export'
import { sampleHost, sampleProfile, sampleGroup, fixedExportedAt } from '../hosts/hostBundle/fixtures'
import {
  buildAppExportDocument,
  buildAppSettingsExport,
  reportToExportItem,
  serializeAppExportDocument
} from './export'
import { APP_BUNDLE_KIND, APP_BUNDLE_VERSION } from './types'
import { createBuiltinUxProfile } from '../ux/defaults'

const sampleAppSettings: AppSettings = {
  autoOpenConnectionLog: false,
  sessionOpenMode: 'workspace'
}

const sampleHostListView: HostListViewSettings = {
  version: 1,
  groupBy: 'none',
  selectedTags: [],
  selectedGroupId: 'all',
  selectedHostId: null,
  collapsedSections: [],
  sortBy: 'name',
  sortDir: 'asc'
}

const sampleMapView: MapViewSettings = {
  version: 1,
  appView: 'list',
  mapMode: 'logical'
}

const sampleVaultSettings: VaultSettings = {
  enabled: false,
  address: '',
  namespace: '',
  defaultKvMount: 'secret',
  secretPathPrefix: 'consoleri',
  defaultBackend: 'local',
  auth: { method: 'token', hasToken: false },
  tlsSkipVerify: false
}

const sampleUxProfile: UxProfile = { ...createBuiltinUxProfile(), id: 'ux1', name: 'Custom' }

const sampleReport: Report = {
  id: 'r1',
  name: 'My Report',
  type: 'connectivity_test',
  config: { type: 'connectivity_test', entries: [] },
  lastRunAt: null,
  lastResult: null,
  createdAt: fixedExportedAt,
  updatedAt: fixedExportedAt
}

describe('appBundle export', () => {
  const settingsExport = buildAppSettingsExport(
    sampleAppSettings,
    sampleHostListView,
    sampleMapView,
    sampleVaultSettings,
    'ux1',
    [sampleUxProfile]
  )

  const hostsDoc = buildHostsExportDocument(
    [sampleGroup],
    [sampleHost],
    [sampleProfile],
    [],
    fixedExportedAt
  )

  describe('buildAppSettingsExport', () => {
    it('collects all settings sections', () => {
      expect(settingsExport.app).toEqual(sampleAppSettings)
      expect(settingsExport.vault).toEqual(sampleVaultSettings)
      expect(settingsExport.activeUxProfileId).toBe('ux1')
      expect(settingsExport.uxProfiles).toHaveLength(1)
    })
  })

  describe('reportToExportItem', () => {
    it('maps id to exportId and preserves all fields', () => {
      const item = reportToExportItem(sampleReport)
      expect(item.exportId).toBe('r1')
      expect(item.name).toBe('My Report')
      expect(item.type).toBe('connectivity_test')
      expect(item.createdAt).toBe(fixedExportedAt)
    })
  })

  describe('buildAppExportDocument', () => {
    it('produces a versioned document with the correct kind', () => {
      const doc = buildAppExportDocument(
        settingsExport,
        [],
        hostsDoc,
        [sampleReport],
        null,
        fixedExportedAt
      )
      expect(doc.kind).toBe(APP_BUNDLE_KIND)
      expect(doc.version).toBe(APP_BUNDLE_VERSION)
      expect(doc.exportedAt).toBe(fixedExportedAt)
      expect(doc.hosts.hosts).toHaveLength(1)
      expect(doc.reports).toHaveLength(1)
      expect(doc.workspace).toBeNull()
    })

    it('includes workspace when provided', () => {
      const doc = buildAppExportDocument(
        settingsExport,
        [],
        hostsDoc,
        [],
        { name: 'Default', layout: null, panes: [{ paneId: 'p1', connectRequest: { hostId: 'h1' } }] },
        fixedExportedAt
      )
      expect(doc.workspace).not.toBeNull()
      expect(doc.workspace!.panes).toHaveLength(1)
    })

    it('includes secrets as-is', () => {
      const secrets = [{ ref: 'vault:auth:token', encryptedBlob: 'base64data==' }]
      const doc = buildAppExportDocument(settingsExport, secrets, hostsDoc, [], null, fixedExportedAt)
      expect(doc.secrets).toEqual(secrets)
    })
  })

  describe('serializeAppExportDocument', () => {
    it('produces pretty-printed JSON with trailing newline', () => {
      const doc = buildAppExportDocument(settingsExport, [], hostsDoc, [], null, fixedExportedAt)
      const serialized = serializeAppExportDocument(doc)
      expect(serialized.endsWith('\n')).toBe(true)
      expect(JSON.parse(serialized)).toMatchObject({ kind: APP_BUNDLE_KIND })
    })
  })
})
