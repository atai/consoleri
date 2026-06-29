import type { ReactNode } from 'react'

export const SCROLLABLE_FORM_MAX_HEIGHT_DEFAULT = 'max-h-[min(70vh,calc(100vh-10rem))]'
export const SCROLLABLE_FORM_MAX_HEIGHT_COMPACT = 'max-h-72'
export const SCROLLABLE_FORM_MAX_HEIGHT_PANEL = 'max-h-[min(50vh,28rem)]'

interface ScrollableFormShellProps {
  title?: ReactNode
  header?: ReactNode
  children: ReactNode
  footer: ReactNode
  maxHeightClass?: string
  bordered?: boolean
}

export function ScrollableFormShell({
  title,
  header,
  children,
  footer,
  maxHeightClass = SCROLLABLE_FORM_MAX_HEIGHT_DEFAULT,
  bordered = true
}: ScrollableFormShellProps): React.JSX.Element {
  const showHeader = header != null || title != null

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden bg-[#0d1117] ${maxHeightClass} ${
        bordered ? 'border-b border-[#30363d]' : ''
      }`}
    >
      {showHeader && (
        <div className="shrink-0 px-4 pt-4">
          {header ?? <h3 className="text-sm font-medium text-gray-100">{title}</h3>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      <div className="shrink-0 border-t border-[#30363d] px-4 py-3">{footer}</div>
    </div>
  )
}
