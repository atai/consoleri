import { describe, expect, it } from 'vitest'
import { insertPaneIntoLayout, removeFromLayout } from './layout'

describe('insertPaneIntoLayout', () => {
  it('creates first pane', () => {
    expect(insertPaneIntoLayout(null, 'a')).toBe('a')
  })

  it('creates binary split from single pane', () => {
    expect(insertPaneIntoLayout('a', 'b')).toEqual({
      type: 'split',
      direction: 'row',
      children: ['a', 'b']
    })
  })

  it('nests third pane as new split (binary tree)', () => {
    const two: MosaicNode = { type: 'split', direction: 'row', children: ['a', 'b'] }
    const result = insertPaneIntoLayout(two, 'c')
    expect(result).toEqual({
      type: 'split',
      direction: 'row',
      children: [{ type: 'split', direction: 'row', children: ['a', 'b'] }, 'c']
    })
  })
})

describe('removeFromLayout', () => {
  it('removes leaf', () => {
    expect(removeFromLayout('a', 'a')).toBeNull()
    expect(removeFromLayout('a', 'b')).toBe('a')
  })

  it('collapses single child after removal', () => {
    const tree = { type: 'split' as const, direction: 'row' as const, children: ['a', 'b'] as const }
    expect(removeFromLayout(tree, 'b')).toBe('a')
  })

  it('removes from nested split', () => {
    const tree = {
      type: 'split' as const,
      direction: 'row' as const,
      children: [{ type: 'split' as const, direction: 'row' as const, children: ['a', 'b'] }, 'c']
    }
    expect(removeFromLayout(tree, 'c')).toEqual({
      type: 'split',
      direction: 'row',
      children: ['a', 'b']
    })
  })
})

type MosaicNode = string | { type: 'split'; direction: 'row' | 'column'; children: MosaicNode[] }
