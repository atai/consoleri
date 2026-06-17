import { Button } from './Button'

export interface DialogFooterProps {
  onCancel: () => void
  onConfirm: () => void
  cancelLabel?: string
  confirmLabel?: string
  confirmCount?: number
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
}

export function DialogFooter({
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmCount,
  loading = false,
  loadingLabel,
  disabled = false
}: DialogFooterProps): React.JSX.Element {
  const countSuffix = confirmCount !== undefined && confirmCount > 0 ? ` (${confirmCount})` : ''
  const label = loading ? (loadingLabel ?? confirmLabel) : `${confirmLabel}${countSuffix}`

  return (
    <div className="flex shrink-0 justify-end gap-2 border-t border-[#30363d] p-4">
      <Button variant="ghost" size="md" onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={onConfirm}
        disabled={disabled || loading}
      >
        {label}
      </Button>
    </div>
  )
}
