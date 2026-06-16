import type { Report } from '@shared/types'
import { HostEntriesReportForm } from './HostEntriesReportForm'

interface InventoryReportFormProps {
  report?: Report
  onSave: () => void | Promise<void>
  onCancel: () => void
}

export function InventoryReportForm({
  report,
  onSave,
  onCancel
}: InventoryReportFormProps): React.JSX.Element {
  return (
    <HostEntriesReportForm
      reportType="inventory"
      title={report ? 'Edit inventory report' : 'New inventory report'}
      report={report}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}
