import { describe, expect, it } from 'vitest'
import { resolveOverlaps } from './resolveOverlaps'

describe('resolveOverlaps', () => {
  it('separates overlapping nodes', () => {
    const nodes = [
      { id: 'a', kind: 'host', x: 0, y: 0 },
      { id: 'b', kind: 'host', x: 10, y: 0 }
    ]
    resolveOverlaps(nodes, () => 50)
    const dist = Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y)
    expect(dist).toBeGreaterThanOrEqual(100)
  })

  it('does not move fixed tag nodes', () => {
    const nodes = [
      { id: 'tag', kind: 'tag', x: 100, y: 100 },
      { id: 'h1', kind: 'host', x: 100, y: 100 }
    ]
    resolveOverlaps(nodes, () => 40, { fixedKinds: ['tag'] })
    expect(nodes[0].x).toBe(100)
    expect(nodes[0].y).toBe(100)
    expect(Math.hypot(nodes[1].x - 100, nodes[1].y - 100)).toBeGreaterThanOrEqual(40)
  })
})
