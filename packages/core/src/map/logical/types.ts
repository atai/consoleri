import type { MapGraphNode } from '../buildGraph'

export interface TagClusterMetrics {
  tagId: string
  hostIds: string[]
  orbitRadius: number
  boundingRadius: number
}

export interface LogicalLayoutNode extends MapGraphNode {
  x: number
  y: number
}
