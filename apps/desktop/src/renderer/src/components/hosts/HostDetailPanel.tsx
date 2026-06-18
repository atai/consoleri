import { HOST_LOG_VERBOSITY_OPTIONS } from '@consoleri/core'
import type { ConnectionProfile, Host } from '@shared/types'
import { EditDeleteActions } from '../ui/EditDeleteActions'
import { HostForm } from './HostForm'
import { HostProfilesSection } from '../profiles/HostProfilesSection'

const PANEL_CLASS =
  'min-h-0 shrink border-t-2 border-blue-500/40 bg-[#0d1117] shadow-[0_-4px_16px_rgba(0,0,0,0.35)]'

const PANEL_BODY_CLASS = 'max-h-[min(50vh,28rem)] overflow-y-auto p-3'

interface HostDetailPanelProps {
  host: Host
  profiles: ConnectionProfile[]
  autoOpenConnectionLog: boolean
  editing: boolean
  onConnect: (host: Host, profileId?: string) => void
  onDelete: (hostId: string) => void | Promise<void>
  onAutoOpenLogChange: (value: boolean) => void
  onEdit: () => void
  onCopy: () => void
  onCancelEdit: () => void
  onHostUpdated: () => void
  onProfilesChanged: () => void
}

export function HostDetailPanel({
  host,
  profiles,
  autoOpenConnectionLog,
  editing,
  onConnect,
  onDelete,
  onAutoOpenLogChange,
  onEdit,
  onCopy,
  onCancelEdit,
  onHostUpdated,
  onProfilesChanged
}: HostDetailPanelProps): React.JSX.Element {
  if (editing) {
    return (
      <div className={PANEL_CLASS}>
        <div className={PANEL_BODY_CLASS}>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-blue-400/80">
            Edit host
          </div>
          <HostForm
            host={host}
            profiles={profiles}
            onConnect={onConnect}
            onProfilesChanged={onProfilesChanged}
            onSave={() => {
              onCancelEdit()
              onHostUpdated()
            }}
            onCancel={onCancelEdit}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={PANEL_CLASS}>
      <div className={PANEL_BODY_CLASS}>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-blue-400/80">
          Connect
        </div>
        <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-200">{host.name}</div>
          <div className="truncate text-xs text-gray-500">
            {host.hostname}:{host.port}
          </div>
          {host.httpEndpoint && (
            <div className="truncate text-xs text-gray-500">{host.httpEndpoint}</div>
          )}
        </div>
        <EditDeleteActions
          resetKey={host.id}
          onEdit={onEdit}
          onCopy={onCopy}
          onDelete={() => onDelete(host.id)}
        />
        </div>

        <HostProfilesSection
          host={host}
          profiles={profiles}
          onConnect={onConnect}
          onProfilesChanged={onProfilesChanged}
        />

        {profiles.length === 0 && (
          <button
            type="button"
            onClick={() => onConnect(host)}
            className="mb-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
          >
            Connect
          </button>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={autoOpenConnectionLog}
            onChange={(e) => onAutoOpenLogChange(e.target.checked)}
          />
          Open log on connect
        </label>

        <p className="mt-2 text-xs text-gray-500">
          Log verbosity:{' '}
          {HOST_LOG_VERBOSITY_OPTIONS.find((option) => option.value === host.logVerbosity)?.label ??
            host.logVerbosity}
        </p>

        {host.notes && <p className="mt-2 text-xs text-gray-500">{host.notes}</p>}
      </div>
    </div>
  )
}
