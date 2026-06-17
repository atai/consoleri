import type { ReactNode } from 'react'

export interface CheckboxPickListItem {
  id: string
}

export interface CheckboxPickListProps<T extends CheckboxPickListItem> {
  items: T[]
  selectedIds: Set<string>
  disabledIds?: Set<string>
  onToggle: (id: string) => void
  renderItem: (item: T) => ReactNode
  renderDisabledBadge?: (item: T) => ReactNode
  emptyMessage?: string
  loading?: boolean
  loadingMessage?: string
}

export function CheckboxPickList<T extends CheckboxPickListItem>({
  items,
  selectedIds,
  disabledIds = new Set(),
  onToggle,
  renderItem,
  renderDisabledBadge,
  emptyMessage = 'No items available.',
  loading = false,
  loadingMessage = 'Loading…'
}: CheckboxPickListProps<T>): React.JSX.Element {
  if (loading) {
    return <p className="p-4 text-sm text-gray-500">{loadingMessage}</p>
  }

  if (items.length === 0) {
    return <p className="p-4 text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const disabled = disabledIds.has(item.id)
        const checked = selectedIds.has(item.id)

        return (
          <li key={item.id}>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${
                disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#21262d]'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
                className="rounded border-[#30363d]"
              />
              <span className="min-w-0 flex-1">{renderItem(item)}</span>
              {disabled && renderDisabledBadge?.(item)}
            </label>
          </li>
        )
      })}
    </ul>
  )
}
