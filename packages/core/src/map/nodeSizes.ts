import type { MapNodeKind } from './buildGraph'

export interface MapNodeSize {
  width: number
  height: number
}

const NODE_SIZES: Record<MapNodeKind, MapNodeSize> = {
  host: { width: 150, height: 118 },
  gateway: { width: 150, height: 118 },
  tag: { width: 72, height: 72 }
}

const COLLISION_PADDING = 16

export function getMapNodeSize(kind: MapNodeKind): MapNodeSize {
  return NODE_SIZES[kind]
}

export function getMapNodeCollisionRadius(kind: MapNodeKind): number {
  const { width, height } = NODE_SIZES[kind]
  return Math.max(width, height) / 2 + COLLISION_PADDING
}

export function layoutCenterToTopLeft(
  centerX: number,
  centerY: number,
  kind: MapNodeKind
): { x: number; y: number } {
  const { width, height } = NODE_SIZES[kind]
  return { x: centerX - width / 2, y: centerY - height / 2 }
}
