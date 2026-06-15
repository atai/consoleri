import type { Host, UxProfile } from '@shared/types'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton'
import { Button } from '../ui/Button'

interface UxProfileListItemProps {
  profile: UxProfile
  host?: Host
  linkedHosts?: Host[]
  isActive: boolean
  onSetActive?: () => void
  onEdit: () => void
  onDelete: () => void | Promise<void>
  onUnlink?: () => void | Promise<void>
}

export function UxProfileListItem({
  profile,
  host,
  linkedHosts = [],
  isActive,
  onSetActive,
  onEdit,
  onDelete,
  onUnlink
}: UxProfileListItemProps): React.JSX.Element {
  const hostLine =
    linkedHosts.length > 0
      ? `hosts: ${linkedHosts.map((h) => h.name).join(', ')}`
      : host
        ? `host: ${host.name}`
        : 'no linked hosts'

  return (
    <li className="border-b border-[#30363d] px-3 py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-200">{profile.name}</span>
            {profile.isBuiltin && (
              <span className="rounded bg-[#21262d] px-1.5 py-0.5 text-[10px] uppercase text-gray-400">
                builtin
              </span>
            )}
            {isActive && (
              <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] text-blue-300">
                active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {hostLine} · {profile.terminal.fontSize}px · scrollback {profile.terminal.scrollback}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSetActive && !isActive && (
            <Button variant="default" size="sm" onClick={onSetActive}>
              Set active
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onEdit}>
            Edit
          </Button>
          {(onUnlink || !profile.isBuiltin) && (
            <ConfirmDeleteButton
              label={onUnlink ? 'Unlink' : 'Delete'}
              confirmLabel={onUnlink ? 'Unlink' : 'Delete'}
              resetKey={profile.id}
              onConfirm={onUnlink ?? onDelete}
              variant="default"
            />
          )}
        </div>
      </div>
    </li>
  )
}
