import type { ReactNode } from 'react'

export interface DialogHeaderProps {
  title: string
  subtitle?: ReactNode
  onClose?: () => void
  bordered?: boolean
}

export function DialogHeader({
  title,
  subtitle,
  onClose,
  bordered = false
}: DialogHeaderProps): React.JSX.Element {
  return (
    <div
      className={`shrink-0 p-4 ${bordered ? 'border-b border-[#30363d]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-gray-100">{title}</h3>
          {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
