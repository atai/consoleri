import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force'
import type { MapGraph, MapGraphNode } from './buildGraph'
import { getMapNodeCollisionRadius } from './nodeSizes'
import { resolveOverlaps } from './resolveOverlaps'

export interface ForceLayoutNode extends MapGraphNode {
  x: number
  y: number
}

interface SimNode extends SimulationNodeDatum, MapGraphNode {
  x: number
  y: number
}

function hostsPerTag(graph: MapGraph): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.kind !== 'membership') continue
    const bucket = map.get(edge.target) ?? []
    bucket.push(edge.source)
    map.set(edge.target, bucket)
  }
  for (const hosts of map.values()) {
    hosts.sort()
  }
  return map
}

function primaryTagForHost(hostNodeId: string, graph: MapGraph): string | null {
  const tags = graph.edges
    .filter((e) => e.kind === 'membership' && e.source === hostNodeId)
    .map((e) => e.target)
  if (tags.length === 0) return null
  const perTag = hostsPerTag(graph)
  return tags.sort((a, b) => (perTag.get(a)?.length ?? 0) - (perTag.get(b)?.length ?? 0))[0]
}

function orbitRadiusForCount(hostCount: number): number {
  const base = 110
  const perHost = 28
  return base + Math.max(0, hostCount - 1) * perHost
}

function placeHostsAroundTags(nodes: SimNode[], graph: MapGraph, centerX: number, centerY: number): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const perTag = hostsPerTag(graph)
  const placed = new Set<string>()

  for (const [tagId, hostIds] of perTag) {
    const tag = nodeById.get(tagId)
    if (!tag) continue
    const ringHosts = hostIds.filter((id) => primaryTagForHost(id, graph) === tagId)
    const count = ringHosts.length
    if (count === 0) continue
    const orbit = orbitRadiusForCount(count)
    ringHosts.forEach((hostId, index) => {
      const host = nodeById.get(hostId)
      if (!host || placed.has(hostId)) return
      const angle = (2 * Math.PI * index) / count - Math.PI / 2
      host.x = tag.x + orbit * Math.cos(angle)
      host.y = tag.y + orbit * Math.sin(angle)
      placed.add(hostId)
    })
  }

  const unplaced = nodes.filter((n) => n.kind === 'host' && !placed.has(n.id))
  if (unplaced.length > 0) {
    const orbit = orbitRadiusForCount(unplaced.length)
    unplaced.forEach((host, index) => {
      const angle = (2 * Math.PI * index) / unplaced.length
      host.x = centerX + orbit * Math.cos(angle)
      host.y = centerY + orbit * Math.sin(angle)
    })
  }
}

export function layoutForceGraph(
  graph: MapGraph,
  width: number,
  height: number
): ForceLayoutNode[] {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.32

  const tagNodes = graph.nodes.filter((n) => n.kind === 'tag')
  const tagIndex = new Map(tagNodes.map((t, i) => [t.id, i]))

  const nodes: SimNode[] = graph.nodes.map((n) => {
    let x = centerX
    let y = centerY
    if (n.kind === 'tag') {
      const i = tagIndex.get(n.id) ?? 0
      const angle = (2 * Math.PI * i) / Math.max(tagNodes.length, 1) - Math.PI / 2
      x = centerX + radius * Math.cos(angle)
      y = centerY + radius * Math.sin(angle)
    }
    return { ...n, x, y }
  })

  placeHostsAroundTags(nodes, graph, centerX, centerY)

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const links = graph.edges.flatMap((e) => {
    const source = nodeById.get(e.source)
    const target = nodeById.get(e.target)
    if (!source || !target) return []
    return [{ source, target }]
  })

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
        .id((d) => d.id)
        .distance((l) => {
          const edge = graph.edges.find(
            (e) =>
              nodeById.get(e.source) === l.source && nodeById.get(e.target) === l.target
          )
          if (edge?.kind === 'membership') return 150
          if (edge?.kind === 'related') return 200
          return 120
        })
        .strength((l) => {
          const edge = graph.edges.find(
            (e) =>
              nodeById.get(e.source) === l.source && nodeById.get(e.target) === l.target
          )
          return edge?.kind === 'membership' ? 0.35 : 0.55
        })
    )
    .force('charge', forceManyBody().strength(-520))
    .force('center', forceCenter(centerX, centerY).strength(0.04))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => getMapNodeCollisionRadius(d.kind))
        .strength(0.9)
        .iterations(3)
    )

  for (const node of nodes) {
    if (node.kind === 'tag') {
      node.fx = node.x
      node.fy = node.y
    }
  }

  simulation.stop()
  for (let i = 0; i < 500; i++) simulation.tick()

  for (const node of nodes) {
    if (node.kind === 'tag') {
      delete node.fx
      delete node.fy
    }
  }

  resolveOverlaps(nodes, (n) => getMapNodeCollisionRadius(n.kind as MapGraphNode['kind']), {
    fixedKinds: ['tag']
  })

  return nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    hostId: n.hostId,
    tag: n.tag,
    x: n.x ?? centerX,
    y: n.y ?? centerY
  }))
}
