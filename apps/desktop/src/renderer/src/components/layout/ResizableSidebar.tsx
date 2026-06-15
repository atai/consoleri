import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '@consoleri/core'
import { useAppStore } from '../../stores/appStore'

interface ResizableSidebarProps {
  children: ReactNode
  expanded?: boolean
}

export function ResizableSidebar({ children, expanded = false }: ResizableSidebarProps): React.JSX.Element {
  const { sidebarWidth, setSidebarWidth } = useAppStore()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(sidebarWidth)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth
    },
    [sidebarWidth]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setSidebarWidth(startWidth.current + delta)
    }
    const onMouseUp = (): void => {
      dragging.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [setSidebarWidth])

  const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth))

  if (expanded) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    )
  }

  return (
    <div className="relative flex h-full shrink-0" style={{ width: clamped }}>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-blue-500/40"
      />
    </div>
  )
}
