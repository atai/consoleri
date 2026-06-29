import type { ReactNode } from 'react'
import { ScrollableFormShell } from '../ui/ScrollableFormShell'

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
    <ScrollableFormShell title={title} footer={footer}>
      {children}
    </ScrollableFormShell>
  )
}
