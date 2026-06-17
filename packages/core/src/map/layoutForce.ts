import type { MapGraph } from './buildGraph'
import { layoutLogicalGraph } from './logical/layoutLogicalGraph'
import type { LogicalLayoutNode } from './logical/types'

export interface ForceLayoutNode extends LogicalLayoutNode {}

/** @deprecated Use layoutLogicalGraph */
export function layoutForceGraph(
  graph: MapGraph,
  width: number,
  height: number
): ForceLayoutNode[] {
  return layoutLogicalGraph(graph, width, height)
}
