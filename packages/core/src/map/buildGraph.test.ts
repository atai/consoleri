import { describe, expect, it } from 'vitest'
import type { Host } from '../types'
import { buildLogicalGraph, buildNetworkGraph } from './buildGraph'

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

describe('buildLogicalGraph', () => {
  it('creates tag nodes and membership edges', () => {
    const hosts = [makeHost({ id: '1', name: 'web', tags: ['prod', 'web'] })]
    const graph = buildLogicalGraph(hosts)
    expect(graph.nodes.filter((n) => n.kind === 'tag').map((n) => n.tag)).toEqual(['prod', 'web'])
    expect(graph.edges.filter((e) => e.kind === 'membership')).toHaveLength(2)
  })

  it('creates related host edges', () => {
    const hosts = [
      makeHost({ id: '1', name: 'a', relatedHostIds: ['2'] }),
      makeHost({ id: '2', name: 'b', relatedHostIds: [] })
    ]
    const graph = buildLogicalGraph(hosts)
    expect(graph.edges.some((e) => e.kind === 'related' && e.source === 'host:1' && e.target === 'host:2')).toBe(
      true
    )
  })
})

describe('buildNetworkGraph', () => {
  it('places hosts behind gateways', () => {
    const hosts = [
      makeHost({ id: 'gw', name: 'bastion' }),
      makeHost({ id: 'app', name: 'app', gatewayHostId: 'gw' })
    ]
    const graph = buildNetworkGraph(hosts)
    expect(graph.nodes.some((n) => n.id === 'gateway:gw')).toBe(true)
    expect(graph.edges.some((e) => e.source === 'gateway:gw' && e.target === 'host:app')).toBe(true)
  })
})
