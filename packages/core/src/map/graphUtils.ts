import type { MapGraph } from './buildGraph'

export function hostsPerTag(graph: MapGraph): Map<string, string[]> {
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

export function primaryTagForHost(hostNodeId: string, graph: MapGraph): string | null {
  const tags = graph.edges
    .filter((e) => e.kind === 'membership' && e.source === hostNodeId)
    .map((e) => e.target)
  if (tags.length === 0) return null
  const perTag = hostsPerTag(graph)
  return tags.sort((a, b) => (perTag.get(a)?.length ?? 0) - (perTag.get(b)?.length ?? 0))[0]
}
