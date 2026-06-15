import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { tagColorFromName } from '@consoleri/core'

function TagMapNodeComponent({ data }: NodeProps): React.JSX.Element {
  const tag = data.tag as string
  const color = tagColorFromName(tag)

  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#30363d] text-center text-[10px] font-semibold text-white shadow-lg"
      style={{ backgroundColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <span className="px-1">#{tag}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  )
}

export const TagMapNode = memo(TagMapNodeComponent)
