import type { MapGraph } from '../buildGraph'
import { estimateTagClusters } from './clusterMetrics'
import { placeHosts } from './placeHosts'
import { placeTags } from './placeTags'
import type { LogicalLayoutNode } from './types'

export function layoutLogicalGraph(
  graph: MapGraph,
  width: number,
  height: number
): LogicalLayoutNode[] {
  const centerX = width / 2
  const centerY = height / 2
  const metrics = estimateTagClusters(graph)
  const tagPositions = placeTags(metrics, width, height)
  return placeHosts(graph, tagPositions, metrics, centerX, centerY)
}
