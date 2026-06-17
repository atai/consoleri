import { describe, expect, it } from 'vitest'
import type { MapGraph } from '../buildGraph'
import { getMapNodeCollisionRadius } from '../nodeSizes'
import { placeHosts } from './placeHosts'
import type { TagClusterMetrics } from './types'

describe('placeHosts', () => {
  it('keeps hosts separated from each other and from the fixed tag', () => {
    const graph: MapGraph = {
      nodes: [
        { id: 'tag:prod', kind: 'tag', label: 'prod', tag: 'prod' },
        { id: 'host:1', kind: 'host', label: 'a', hostId: '1' },
        { id: 'host:2', kind: 'host', label: 'b', hostId: '2' },
        { id: 'host:3', kind: 'host', label: 'c', hostId: '3' }
      ],
      edges: [
        { id: 'm1', source: 'host:1', target: 'tag:prod', kind: 'membership' },
        { id: 'm2', source: 'host:2', target: 'tag:prod', kind: 'membership' },
        { id: 'm3', source: 'host:3', target: 'tag:prod', kind: 'membership' }
      ]
    }

    const metrics = new Map<string, TagClusterMetrics>([
      [
        'tag:prod',
        {
          tagId: 'tag:prod',
          hostIds: ['host:1', 'host:2', 'host:3'],
          orbitRadius: 220,
          boundingRadius: 320
        }
      ]
    ])
    const tagPositions = new Map([['tag:prod', { x: 400, y: 300 }]])
    const nodes = placeHosts(graph, tagPositions, metrics, 400, 300)

    const tag = nodes.find((node) => node.kind === 'tag')!
    const hosts = nodes.filter((node) => node.kind === 'host')
    const hostRadius = getMapNodeCollisionRadius('host')
    const tagRadius = getMapNodeCollisionRadius('tag')

    for (let i = 0; i < hosts.length; i++) {
      for (let j = i + 1; j < hosts.length; j++) {
        const dist = Math.hypot(hosts[j].x - hosts[i].x, hosts[j].y - hosts[i].y)
        expect(dist).toBeGreaterThanOrEqual(hostRadius * 2 - 1)
      }
    }

    for (const host of hosts) {
      const dist = Math.hypot(host.x - tag.x, host.y - tag.y)
      expect(dist).toBeGreaterThanOrEqual(tagRadius + hostRadius - 1)
    }
  })

  it('does not move fixed tag nodes during overlap resolution', () => {
    const graph: MapGraph = {
      nodes: [
        { id: 'tag:prod', kind: 'tag', label: 'prod', tag: 'prod' },
        { id: 'host:1', kind: 'host', label: 'a', hostId: '1' }
      ],
      edges: [{ id: 'm1', source: 'host:1', target: 'tag:prod', kind: 'membership' }]
    }
    const metrics = new Map<string, TagClusterMetrics>([
      [
        'tag:prod',
        {
          tagId: 'tag:prod',
          hostIds: ['host:1'],
          orbitRadius: 150,
          boundingRadius: 220
        }
      ]
    ])
    const tagPositions = new Map([['tag:prod', { x: 250, y: 180 }]])
    const nodes = placeHosts(graph, tagPositions, metrics, 400, 300)
    const tag = nodes.find((node) => node.kind === 'tag')!
    expect(tag.x).toBe(250)
    expect(tag.y).toBe(180)
  })
})
