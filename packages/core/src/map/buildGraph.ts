import type { Host } from '../types'

export type MapNodeKind = 'host' | 'tag' | 'gateway'
export type MapEdgeKind = 'membership' | 'related' | 'related-reverse' | 'gateway'

export interface MapGraphNode {
  id: string
  kind: MapNodeKind
  label: string
  hostId?: string
  tag?: string
}

export interface MapGraphEdge {
  id: string
  source: string
  target: string
  kind: MapEdgeKind
}

export interface MapGraph {
  nodes: MapGraphNode[]
  edges: MapGraphEdge[]
}

export function buildLogicalGraph(hosts: Host[]): MapGraph {
  const nodes: MapGraphNode[] = []
  const edges: MapGraphEdge[] = []
  const tagIds = new Set<string>()
  const hostIds = new Set(hosts.map((h) => h.id))

  for (const host of hosts) {
    nodes.push({
      id: `host:${host.id}`,
      kind: 'host',
      label: host.name,
      hostId: host.id
    })
    for (const tag of host.tags) {
      const tagNodeId = `tag:${tag}`
      if (!tagIds.has(tag)) {
        tagIds.add(tag)
        nodes.push({ id: tagNodeId, kind: 'tag', label: tag, tag })
      }
      edges.push({
        id: `membership:${host.id}:${tag}`,
        source: `host:${host.id}`,
        target: tagNodeId,
        kind: 'membership'
      })
    }
    for (const relatedId of host.relatedHostIds) {
      if (!hostIds.has(relatedId)) continue
      edges.push({
        id: `related:${host.id}:${relatedId}`,
        source: `host:${host.id}`,
        target: `host:${relatedId}`,
        kind: 'related'
      })
    }
  }

  for (const host of hosts) {
    for (const other of hosts) {
      if (other.id === host.id) continue
      if (other.relatedHostIds.includes(host.id) && !host.relatedHostIds.includes(other.id)) {
        const edgeId = `related-reverse:${other.id}:${host.id}`
        if (!edges.some((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: `host:${other.id}`,
            target: `host:${host.id}`,
            kind: 'related-reverse'
          })
        }
      }
    }
  }

  return { nodes, edges }
}

export function buildNetworkGraph(hosts: Host[]): MapGraph {
  const nodes: MapGraphNode[] = []
  const edges: MapGraphEdge[] = []
  const hostIds = new Set(hosts.map((h) => h.id))
  const gatewayIds = new Set<string>()

  for (const host of hosts) {
    if (host.gatewayHostId && hostIds.has(host.gatewayHostId)) {
      gatewayIds.add(host.gatewayHostId)
    }
  }

  for (const host of hosts) {
    const isGateway = gatewayIds.has(host.id)
    const behindGateway = host.gatewayHostId && hostIds.has(host.gatewayHostId)

    if (behindGateway) {
      nodes.push({
        id: `host:${host.id}`,
        kind: 'host',
        label: host.name,
        hostId: host.id
      })
      edges.push({
        id: `gateway:${host.gatewayHostId}:${host.id}`,
        source: `gateway:${host.gatewayHostId}`,
        target: `host:${host.id}`,
        kind: 'gateway'
      })
    } else {
      nodes.push({
        id: isGateway ? `gateway:${host.id}` : `host:${host.id}`,
        kind: isGateway ? 'gateway' : 'host',
        label: host.name,
        hostId: host.id
      })
    }
  }

  return { nodes, edges }
}
