import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Host } from '@shared/types'
import { HostConnectControl } from '../hosts/HostConnectControl'
import { osIcon } from '../hosts/osIcon'

export interface HostMapNodeData {
  label: string
  host?: Host
  onConnect?: (host: Host, profileId?: string) => void
  selected?: boolean
}

function HostMapNodeComponent({ data }: NodeProps): React.JSX.Element {
  const host = data.host as Host | undefined
  const onConnect = data.onConnect as ((host: Host, profileId?: string) => void) | undefined
  const selected = Boolean(data.selected)

  return (
    <div
      className={`min-w-[120px] rounded border px-3 py-2 shadow-lg ${
        selected ? 'border-blue-500 bg-[#1c2d41]' : 'border-[#30363d] bg-[#21262d]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="flex items-center gap-2">
        {host && <span className="text-base">{osIcon(host.osType)}</span>}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-100">{data.label as string}</div>
          {host && (
            <div className="truncate text-[10px] text-gray-500">
              {host.hostname}:{host.port}
            </div>
          )}
        </div>
      </div>
      {host && onConnect && <HostConnectControl host={host} onConnect={onConnect} />}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  )
}

export const HostMapNode = memo(HostMapNodeComponent)
