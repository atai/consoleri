import type { ConnectionProfile, Host } from '@shared/types'
import { profileSummaryLines } from './profileDisplay'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton'
import { Button } from '../ui/Button'

interface ProfileListItemProps {
  profile: ConnectionProfile
  host?: Host
  hosts: Host[]
  linkedHosts?: Host[]
  compact?: boolean
  showLinkedHosts?: boolean
  deleteLabel?: string
  confirmDeleteLabel?: string
  onConnect?: (profileId: string) => void
  onEdit: () => void
  onDelete: () => void | Promise<void>
  onUnlink?: () => void | Promise<void>
}

export function ProfileListItem({
  profile,
  host,
  hosts,
  linkedHosts = [],
  compact = false,
  showLinkedHosts = !compact,
  deleteLabel = 'Delete',
  confirmDeleteLabel = 'Delete',
  onConnect,
  onEdit,
  onDelete,
  onUnlink
}: ProfileListItemProps): React.JSX.Element {
  const isDefault = host?.defaultProfileId === profile.id
  const summary = profileSummaryLines(profile, hosts)
  const hostLine =
    showLinkedHosts && linkedHosts.length > 0
      ? `hosts: ${linkedHosts.map((h) => h.name).join(', ')}`
      : showLinkedHosts
        ? 'no linked hosts'
        : null

  return (
    <li
      className={`border-b border-[#30363d] ${compact ? 'px-0 py-2' : 'px-3 py-2.5'} last:border-b-0`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-200">{profile.name}</span>
            <span className="rounded bg-[#21262d] px-1.5 py-0.5 text-[10px] uppercase text-gray-400">
              {profile.protocol}
            </span>
            {isDefault && (
              <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] text-blue-300">
                default
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {[hostLine, ...summary].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onConnect && (
            <Button variant="primary" size="sm" onClick={() => onConnect(profile.id)}>
              Connect
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <ConfirmDeleteButton
            label={onUnlink ? 'Remove' : deleteLabel}
            confirmLabel={onUnlink ? 'Remove' : confirmDeleteLabel}
            resetKey={profile.id}
            onConfirm={onUnlink ?? onDelete}
            variant="default"
          />
        </div>
      </div>
    </li>
  )
}
