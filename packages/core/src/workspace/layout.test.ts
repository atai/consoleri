import { describe, expect, it } from 'vitest'
import { insertPaneIntoLayout, removeFromLayout, splitPaneInLayout } from './layout'

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

describe('splitPaneInLayout', () => {
  it('splits a single leaf into row split', () => {
    expect(splitPaneInLayout('a', 'a', 'b', 'row')).toEqual({
      type: 'split',
      direction: 'row',
      children: ['a', 'b'],
      splitPercentages: [50, 50]
    })
  })

  it('splits a single leaf into column split', () => {
    expect(splitPaneInLayout('a', 'a', 'b', 'column', [40, 60])).toEqual({
      type: 'split',
      direction: 'column',
      children: ['a', 'b'],
      splitPercentages: [40, 60]
    })
  })

  it('returns leaf unchanged when target not found', () => {
    expect(splitPaneInLayout('a', 'b', 'c', 'row')).toBe('a')
  })

  it('splits target inside nested tree', () => {
    const tree = {
      type: 'split' as const,
      direction: 'row' as const,
      children: ['a', { type: 'split' as const, direction: 'column' as const, children: ['b', 'c'] }]
    }
    expect(splitPaneInLayout(tree, 'b', 'd', 'row')).toEqual({
      type: 'split',
      direction: 'row',
      children: [
        'a',
        {
          type: 'split',
          direction: 'column',
          children: [
            { type: 'split', direction: 'row', children: ['b', 'd'], splitPercentages: [50, 50] },
            'c'
          ]
        }
      ]
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
