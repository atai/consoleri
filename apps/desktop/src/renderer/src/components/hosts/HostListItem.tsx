import type { Host } from '@shared/types'
import { EditDeleteActions } from '../ui/EditDeleteActions'

const OS_ICON: Record<string, string> = {
  windows: '⊞',
  linux: '🐧',
  macos: '',
  unknown: '?'
}

function osIcon(os: string): string {
  return OS_ICON[os] ?? '?'
}

export interface HostListItemProps {
  host: Host
  selected: boolean
  onSelect: () => void
  onConnect: () => void
  onEdit: () => void
  onDelete: () => void | Promise<void>
}

export function HostListItem({
  host,
  selected,
  onSelect,
  onConnect,
  onEdit,
  onDelete
}: HostListItemProps): React.JSX.Element {
  return (
    <li
      className={`group flex items-start gap-1 px-2 py-1.5 ${
        selected ? 'bg-[#21262d]' : 'hover:bg-[#21262d]/70'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onConnect}
        className="flex min-w-0 flex-1 items-start gap-2 px-1 py-0.5 text-left text-sm"
      >
        <span className="mt-0.5 text-base">{osIcon(host.osType)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-200">{host.name}</div>
          <div className="truncate text-xs text-gray-500">
            {host.hostname}:{host.port}
          </div>
          {host.tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {host.tags.map((t) => (
                <span key={t} className="text-[10px] text-blue-400">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      <div
        className={`shrink-0 pt-0.5 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <EditDeleteActions resetKey={host.id} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}
