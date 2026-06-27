'use client'

import { useMemo, useState } from 'react'

export function useRowSelection<T extends { id: string }>(allItems: T[], filteredItems: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const selected = useMemo(
    () => allItems.filter((item) => selectedIds.has(item.id)),
    [allItems, selectedIds],
  )

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id))

  function isSelected(id: string) {
    return selectedIds.has(id)
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredItems.forEach((item) => next.delete(item.id))
      } else {
        filteredItems.forEach((item) => next.add(item.id))
      }
      return next
    })
  }

  function clear() {
    setSelectedIds(new Set())
  }

  return {
    selected,
    selectedIds,
    allFilteredSelected,
    isSelected,
    toggle,
    toggleAllFiltered,
    clear,
  }
}
