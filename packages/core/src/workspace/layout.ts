import type { MosaicNode, MosaicSplitNode } from '../types'

export function insertPaneIntoLayout<T extends string>(
  current: MosaicNode<T> | null,
  paneId: T,
  direction: 'row' | 'column' = 'row'
): MosaicNode<T> {
  if (!current) return paneId
  if (typeof current === 'string') {
    return { type: 'split', direction, children: [current, paneId] }
  }
  if (current.type === 'tabs') {
    return { type: 'split', direction, children: [current, paneId] }
  }
  return { type: 'split', direction, children: [current, paneId] }
}

export function removeFromLayout<T extends string>(
  node: MosaicNode<T>,
  paneId: T
): MosaicNode<T> | null {
  if (typeof node === 'string') {
    return node === paneId ? null : node
  }
  if (node.type === 'tabs') {
    const tabs = node.tabs.filter((t) => t !== paneId)
    if (tabs.length === 0) return null
    if (tabs.length === 1) return tabs[0]
    const activeTab = tabs.includes(node.activeTab) ? node.activeTab : tabs[0]
    return { type: 'tabs', tabs, activeTab }
  }
  const split = node as MosaicSplitNode<T>
  const children = split.children
    .map((c) => removeFromLayout(c, paneId))
    .filter((c): c is MosaicNode<T> => c !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...split, children }
}
