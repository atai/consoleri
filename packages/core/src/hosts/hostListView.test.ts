import { describe, expect, it } from 'vitest'
import type { Host } from '../types'
import {
  DEFAULT_HOST_LIST_VIEW,
  buildHostListSections,
  groupHostsByTag,
  mergeHostListViewSettings,
  normalizeHostListViewSettings,
  parseHostListViewJson,
  sortHostListSections,
  sortHosts
} from './hostListView'

function makeHost(overrides: Partial<Host> & Pick<Host, 'id' | 'name'>): Host {
  return {
    hostname: 'host.example',
    port: 22,
    osType: 'linux',
    tags: [],
    groupId: null,
    notes: '',
    defaultProfileId: null,
    uxProfileId: null,
    logVerbosity: 'info',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('normalizeHostListViewSettings', () => {
  it('returns defaults for invalid input', () => {
    expect(normalizeHostListViewSettings(null)).toEqual(DEFAULT_HOST_LIST_VIEW)
    expect(normalizeHostListViewSettings('bad')).toEqual(DEFAULT_HOST_LIST_VIEW)
  })

  it('normalizes partial input and migrates version 0 to 1', () => {
    const result = normalizeHostListViewSettings({
      groupBy: 'tag',
      selectedTags: [' prod ', 'prod', 1, 'web'],
      sortBy: 'hostname',
      sortDir: 'desc'
    })
    expect(result.version).toBe(1)
    expect(result.groupBy).toBe('tag')
    expect(result.selectedTags).toEqual(['prod', 'web'])
    expect(result.sortBy).toBe('hostname')
    expect(result.sortDir).toBe('desc')
  })

  it('falls back invalid enum values', () => {
    const result = normalizeHostListViewSettings({
      groupBy: 'invalid',
      sortBy: 'invalid',
      sortDir: 'invalid',
      selectedGroupId: ''
    })
    expect(result.groupBy).toBe('none')
    expect(result.sortBy).toBe('name')
    expect(result.sortDir).toBe('asc')
    expect(result.selectedGroupId).toBe('all')
  })
})

describe('parseHostListViewJson', () => {
  it('parses valid json and ignores broken json', () => {
    expect(parseHostListViewJson('{"groupBy":"tag"}').groupBy).toBe('tag')
    expect(parseHostListViewJson('{bad')).toEqual(DEFAULT_HOST_LIST_VIEW)
    expect(parseHostListViewJson(undefined)).toEqual(DEFAULT_HOST_LIST_VIEW)
  })
})

describe('mergeHostListViewSettings', () => {
  it('merges patches through normalization', () => {
    const merged = mergeHostListViewSettings(DEFAULT_HOST_LIST_VIEW, {
      selectedHostId: ' host-1 ',
      collapsedSections: ['tag:prod']
    })
    expect(merged.selectedHostId).toBe('host-1')
    expect(merged.collapsedSections).toEqual(['tag:prod'])
  })
})

describe('groupHostsByTag', () => {
  it('duplicates hosts across tag sections and groups untagged hosts', () => {
    const hosts = [
      makeHost({ id: '1', name: 'alpha', tags: ['prod', 'web'] }),
      makeHost({ id: '2', name: 'beta', tags: ['prod'] }),
      makeHost({ id: '3', name: 'gamma', tags: [] })
    ]

    const sections = groupHostsByTag(hosts)
    expect(sections.map((s) => s.id)).toEqual(['tag:prod', 'tag:web', 'untagged'])
    expect(sections[0].hosts.map((h) => h.id)).toEqual(['1', '2'])
    expect(sections[1].hosts.map((h) => h.id)).toEqual(['1'])
    expect(sections[2].hosts.map((h) => h.id)).toEqual(['3'])
  })

  it('returns empty list for no hosts', () => {
    expect(groupHostsByTag([])).toEqual([])
  })
})

describe('sortHosts', () => {
  it('sorts by name descending', () => {
    const hosts = [
      makeHost({ id: '1', name: 'bravo' }),
      makeHost({ id: '2', name: 'alpha' })
    ]
    expect(sortHosts(hosts, 'name', 'desc').map((h) => h.name)).toEqual(['bravo', 'alpha'])
  })
})

describe('buildHostListSections', () => {
  it('returns flat section for groupBy none', () => {
    const hosts = [makeHost({ id: '1', name: 'alpha', osType: 'windows' })]
    const sections = buildHostListSections(hosts, 'none')
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe('all')
    expect(sections[0].hosts).toHaveLength(1)
  })

  it('groups by os type', () => {
    const hosts = [
      makeHost({ id: '1', name: 'win', osType: 'windows' }),
      makeHost({ id: '2', name: 'linux', osType: 'linux' })
    ]
    const sections = buildHostListSections(hosts, 'osType')
    expect(sections.map((s) => s.id)).toEqual(['os:linux', 'os:windows'])
  })

  it('sorts flat hosts by selected field', () => {
    const hosts = [
      makeHost({ id: '1', name: 'bravo', hostname: 'z.example' }),
      makeHost({ id: '2', name: 'alpha', hostname: 'a.example' })
    ]
    const byName = buildHostListSections(hosts, 'none', 'name', 'asc')[0].hosts
    const byHostname = buildHostListSections(hosts, 'none', 'hostname', 'asc')[0].hosts
    expect(byName.map((h) => h.name)).toEqual(['alpha', 'bravo'])
    expect(byHostname.map((h) => h.hostname)).toEqual(['a.example', 'z.example'])
  })

  it('sorts grouped sections by label', () => {
    const hosts = [
      makeHost({ id: '1', name: 'a', tags: ['web'] }),
      makeHost({ id: '2', name: 'b', tags: ['prod'] })
    ]
    const asc = groupHostsByTag(hosts, 'asc').map((s) => s.id)
    const desc = groupHostsByTag(hosts, 'desc').map((s) => s.id)
    expect(asc).toEqual(['tag:prod', 'tag:web'])
    expect(desc).toEqual(['tag:web', 'tag:prod'])
  })
})

describe('sortHostListSections', () => {
  it('keeps untagged section last', () => {
    const sections = sortHostListSections(
      [
        { id: 'untagged', label: 'Untagged', hosts: [] },
        { id: 'tag:prod', label: '#prod', hosts: [] },
        { id: 'tag:web', label: '#web', hosts: [] }
      ],
      'asc'
    )
    expect(sections.map((s) => s.id)).toEqual(['tag:prod', 'tag:web', 'untagged'])
  })
})
