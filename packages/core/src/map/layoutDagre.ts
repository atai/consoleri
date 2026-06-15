import dagre from 'dagre'
import type { MapGraph, MapGraphNode } from './buildGraph'
import { getMapNodeSize } from './nodeSizes'
import { resolveOverlaps } from './resolveOverlaps'

export interface DagreLayoutNode extends MapGraphNode {
  x: number
  y: number
}

export function layoutDagreGraph(graph: MapGraph): DagreLayoutNode[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 110, marginx: 48, marginy: 48 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of graph.nodes) {
    const size = getMapNodeSize(node.kind)
    g.setNode(node.id, { width: size.width, height: size.height })
  }

  for (const edge of graph.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const nodes: DagreLayoutNode[] = graph.nodes.map((node) => {
    const layoutNode = g.node(node.id)
    return {
      ...node,
      x: layoutNode?.x ?? 0,
      y: layoutNode?.y ?? 0
    }
  })

  resolveOverlaps(nodes, (n) => {
    const size = getMapNodeSize(n.kind as MapGraphNode['kind'])
    return Math.max(size.width, size.height) / 2 + 16
  })

  return nodes
}
