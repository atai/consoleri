import { useCallback, useState } from 'react'

export interface PickSelection {
  selectedIds: Set<string>
  toggle: (id: string) => void
  clear: () => void
  pruneTo: (validIds: Iterable<string>) => void
}

export function usePickSelection(): PickSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback((): void => {
    setSelectedIds(new Set())
  }, [])

  const pruneTo = useCallback((validIds: Iterable<string>): void => {
    const valid = new Set(validIds)
    setSelectedIds((prev) => {
      let changed = false
      for (const id of prev) {
        if (!valid.has(id)) {
          changed = true
          break
        }
      }
      if (!changed) return prev

      const next = new Set<string>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
      }
      return next
    })
  }, [])

  return { selectedIds, toggle, clear, pruneTo }
}
