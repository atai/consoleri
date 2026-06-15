import { Button } from './Button'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'

export interface EditDeleteActionsProps {
  onEdit: () => void
  onDelete: () => void | Promise<void>
  editLabel?: string
  deleteLabel?: string
  confirmDeleteLabel?: string
  disabled?: boolean
  resetKey?: string | number
  className?: string
}

export function EditDeleteActions({
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  confirmDeleteLabel = 'Delete',
  disabled = false,
  resetKey,
  className = ''
}: EditDeleteActionsProps): React.JSX.Element {
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <Button variant="default" size="sm" disabled={disabled} onClick={onEdit}>
        {editLabel}
      </Button>
      <ConfirmDeleteButton
        label={deleteLabel}
        confirmLabel={confirmDeleteLabel}
        disabled={disabled}
        resetKey={resetKey}
        onConfirm={onDelete}
        variant="default"
      />
    </div>
  )
}
