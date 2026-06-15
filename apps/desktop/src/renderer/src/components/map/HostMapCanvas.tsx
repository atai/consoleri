import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  buildLogicalGraph,
  buildNetworkGraph,
  layoutDagreGraph,
  layoutForceGraph,
  layoutCenterToTopLeft,
  type MapGraphEdge
} from '@consoleri/core'
import type { Host } from '@shared/types'
import { HostMapNode } from './HostMapNode'
import { TagMapNode } from './TagMapNode'
import { GatewayMapNode } from './GatewayMapNode'
import { useAppStore } from '../../stores/appStore'
import { connectHostInWindow } from '../../session/connectHost'

const nodeTypes = {
  host: HostMapNode,
  tag: TagMapNode,
  gateway: GatewayMapNode
}

function edgeStyle(kind: MapGraphEdge['kind']): Partial<Edge> {
  if (kind === 'membership') {
    return { style: { stroke: '#484f58', strokeDasharray: '4 4' }, animated: false }
  }
  if (kind === 'related-reverse') {
    return { style: { stroke: '#58a6ff', strokeDasharray: '6 4', opacity: 0.5 } }
  }
  if (kind === 'gateway') {
    return { style: { stroke: '#d29922' }, animated: true }
  }
  return { style: { stroke: '#58a6ff' } }
}

interface HostMapCanvasProps {
  hosts: Host[]
}

export function HostMapCanvas({ hosts }: HostMapCanvasProps): React.JSX.Element {
  const { mapMode } = useAppStore()
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const hostById = useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts])

  const handleConnect = useCallback((host: Host, profileId?: string) => {
    void connectHostInWindow(host, profileId)
  }, [])

  useEffect(() => {
    const width = 1200
    const height = 800
    const graph = mapMode === 'logical' ? buildLogicalGraph(hosts) : buildNetworkGraph(hosts)
    const positioned =
      mapMode === 'logical'
        ? layoutForceGraph(graph, width, height)
        : layoutDagreGraph(graph)

    const flowNodes: Node[] = positioned.map((n) => {
      const host = n.hostId ? hostById.get(n.hostId) : undefined
      const position = layoutCenterToTopLeft(n.x, n.y, n.kind)
      return {
        id: n.id,
        type: n.kind,
        position,
        data: {
          label: n.label,
          host,
          tag: n.tag,
          onConnect: host ? handleConnect : undefined,
          selected: n.hostId === selectedHostId
        },
        selectable: n.kind !== 'tag'
      }
    })

    const flowEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...edgeStyle(e.kind)
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [hosts, mapMode, hostById, handleConnect, selectedHostId, setNodes, setEdges])

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const hostId = (node.data.host as Host | undefined)?.id
    setSelectedHostId(hostId ?? null)
  }, [])

  if (hosts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        No hosts to display
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-[#0f1117]"
    >
      <Background gap={20} size={1} color="#21262d" />
      <Controls className="!border-[#30363d] !bg-[#161b22] !shadow-lg [&>button]:!border-[#30363d] [&>button]:!bg-[#21262d] [&>button]:!text-gray-300" />
      <MiniMap
        className="!border-[#30363d] !bg-[#161b22]"
        nodeColor={(node) => (node.type === 'tag' ? '#388bfd' : '#21262d')}
        maskColor="rgba(0,0,0,0.6)"
      />
    </ReactFlow>
  )
}
