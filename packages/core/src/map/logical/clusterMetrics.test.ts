import { describe, expect, it } from 'vitest'
import type { Host } from '../types'
import { buildLogicalGraph } from '../buildGraph'
import { estimateTagClusters, orbitRadiusForHostCount } from './clusterMetrics'
import { getMapNodeCollisionRadius } from '../nodeSizes'

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
    relatedHostIds: [],
    gatewayHostId: null,
    httpEndpoint: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('orbitRadiusForHostCount', () => {
  it('uses minimum orbit for a single host', () => {
    const tagRadius = getMapNodeCollisionRadius('tag')
    const hostRadius = getMapNodeCollisionRadius('host')
    expect(orbitRadiusForHostCount(1)).toBe(tagRadius + hostRadius)
  })

  it('grows orbit radius for more hosts on the ring', () => {
    expect(orbitRadiusForHostCount(6)).toBeGreaterThan(orbitRadiusForHostCount(1))
  })
})

describe('estimateTagClusters', () => {
  it('assigns primary hosts to each tag cluster', () => {
    const hosts = [
      makeHost({ id: '1', name: 'a', tags: ['prod'] }),
      makeHost({ id: '2', name: 'b', tags: ['prod', 'web'] }),
      makeHost({ id: '3', name: 'c', tags: ['web'] })
    ]
    const graph = buildLogicalGraph(hosts)
    const metrics = estimateTagClusters(graph)

    expect(metrics.get('tag:prod')?.hostIds).toEqual(['host:1', 'host:2'])
    expect(metrics.get('tag:web')?.hostIds).toEqual(['host:3'])
  })

  it('includes bounding radius larger than orbit radius', () => {
    const hosts = [makeHost({ id: '1', name: 'a', tags: ['prod'] })]
    const metrics = estimateTagClusters(buildLogicalGraph(hosts))
    const cluster = metrics.get('tag:prod')!
    expect(cluster.boundingRadius).toBeGreaterThan(cluster.orbitRadius)
  })

  it('uses tag-only bounding radius for empty clusters', () => {
    const graph = {
      nodes: [{ id: 'tag:empty', kind: 'tag' as const, label: 'empty', tag: 'empty' }],
      edges: []
    }
    const metrics = estimateTagClusters(graph)
    const cluster = metrics.get('tag:empty')!
    const tagRadius = getMapNodeCollisionRadius('tag')
    expect(cluster.hostIds).toEqual([])
    expect(cluster.boundingRadius).toBe(tagRadius + 16)
  })
})
