import { describe, expect, it } from 'vitest'
import type { TagClusterMetrics } from './types'
import { placeTags } from './placeTags'

function makeMetrics(
  entries: Array<[string, Partial<TagClusterMetrics> & Pick<TagClusterMetrics, 'boundingRadius'>]>
): Map<string, TagClusterMetrics> {
  return new Map(
    entries.map(([tagId, partial]) => [
      tagId,
      {
        tagId,
        hostIds: partial.hostIds ?? [],
        orbitRadius: partial.orbitRadius ?? partial.boundingRadius,
        boundingRadius: partial.boundingRadius
      }
    ])
  )
}

describe('placeTags', () => {
  it('places a single tag at the canvas center', () => {
    const metrics = makeMetrics([['tag:a', { boundingRadius: 60 }]])
    const positions = placeTags(metrics, 800, 600)
    expect(positions.get('tag:a')).toEqual({ x: 400, y: 300 })
  })

  it('separates two large clusters', () => {
    const metrics = makeMetrics([
      ['tag:a', { boundingRadius: 200 }],
      ['tag:b', { boundingRadius: 200 }]
    ])
    const positions = placeTags(metrics, 1200, 800)
    const a = positions.get('tag:a')!
    const b = positions.get('tag:b')!
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    expect(dist).toBeGreaterThanOrEqual(400)
  })
})
