import type { ReactNode } from 'react'

interface ReportFormShellProps {
  title: string
  children: ReactNode
  footer: ReactNode
}

export function ReportFormShell({
  title,
  children,
  footer
}: ReportFormShellProps): React.JSX.Element {
  return (
    <div className="flex max-h-[min(70vh,calc(100vh-10rem))] min-h-0 flex-col overflow-hidden border-b border-[#30363d] bg-[#0d1117]">
      <div className="shrink-0 px-4 pt-4">
        <h3 className="text-sm font-medium text-gray-100">{title}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      <div className="shrink-0 border-t border-[#30363d] px-4 py-3">{footer}</div>
    </div>
  )
}
