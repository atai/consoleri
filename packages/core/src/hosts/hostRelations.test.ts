import { describe, expect, it } from 'vitest'
import { normalizeGatewayHostId, normalizeRelatedHostIds } from './hostRelations'

describe('normalizeRelatedHostIds', () => {
  const ids = new Set(['a', 'b', 'c'])

  it('filters self and unknown ids', () => {
    expect(normalizeRelatedHostIds('a', ['a', 'b', 'missing', 'b'], ids)).toEqual(['b'])
  })
})

describe('normalizeGatewayHostId', () => {
  const hosts = [
    { id: 'a', gatewayHostId: null },
    { id: 'b', gatewayHostId: 'a' }
  ]

  it('rejects self and cycles', () => {
    expect(normalizeGatewayHostId('a', 'a', hosts)).toBeNull()
    expect(normalizeGatewayHostId('a', 'b', hosts)).toBeNull()
    expect(normalizeGatewayHostId('b', 'a', hosts)).toBe('a')
  })
})
