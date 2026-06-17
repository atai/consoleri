import type { MapGraph, MapGraphNode } from '../buildGraph'
import { getMapNodeCollisionRadius } from '../nodeSizes'
import { resolveOverlaps, type LayoutPoint } from '../resolveOverlaps'
import { orbitRadiusForHostCount } from './clusterMetrics'
import type { LogicalLayoutNode, TagClusterMetrics } from './types'

type HostLayoutNode = LayoutPoint & MapGraphNode

export function placeHosts(
  graph: MapGraph,
  tagPositions: Map<string, { x: number; y: number }>,
  metrics: Map<string, TagClusterMetrics>,
  centerX: number,
  centerY: number
): LogicalLayoutNode[] {
  const nodes: HostLayoutNode[] = graph.nodes.map((node) => {
    if (node.kind === 'tag') {
      const position = tagPositions.get(node.id) ?? { x: centerX, y: centerY }
      return { ...node, x: position.x, y: position.y }
    }
    return { ...node, x: centerX, y: centerY }
  })

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const placed = new Set<string>()

  for (const [tagId, cluster] of metrics) {
    const tag = nodeById.get(tagId)
    if (!tag) continue

    const { hostIds, orbitRadius } = cluster
    if (hostIds.length === 0) continue

    hostIds.forEach((hostId, index) => {
      const host = nodeById.get(hostId)
      if (!host || placed.has(hostId)) return
      const angle = (2 * Math.PI * index) / hostIds.length - Math.PI / 2
      host.x = tag.x + orbitRadius * Math.cos(angle)
      host.y = tag.y + orbitRadius * Math.sin(angle)
      placed.add(hostId)
    })
  }

  const unplaced = nodes.filter((node) => node.kind === 'host' && !placed.has(node.id))
  if (unplaced.length > 0) {
    const orbit = orbitRadiusForHostCount(unplaced.length)
    unplaced.forEach((host, index) => {
      const angle = (2 * Math.PI * index) / unplaced.length
      host.x = centerX + orbit * Math.cos(angle)
      host.y = centerY + orbit * Math.sin(angle)
    })
  }

  resolveOverlaps(nodes, (node) => getMapNodeCollisionRadius(node.kind as MapGraphNode['kind']), {
    fixedKinds: ['tag']
  })

  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    label: node.label,
    hostId: node.hostId,
    tag: node.tag,
    x: node.x,
    y: node.y
  }))
}
