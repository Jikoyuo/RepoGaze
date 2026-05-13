'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
  NodeTypes,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCode,
  Box,
  Layers,
  File,
  Zap,
  ChevronRight,
  X,
  Download,
  Maximize2,
  Minimize2,
  GitBranch,
  Workflow,
  Sparkles,
  Hash,
} from 'lucide-react'
import { clsx } from 'clsx'

interface AnalysisNode {
  id: string
  label: string
  type: string
  language: string
  summary: string
  position: { x: number; y: number }
}

interface AnalysisEdge {
  from: string
  to: string
  label: string
}

interface AnalysisResponse {
  nodes: AnalysisNode[]
  edges: AnalysisEdge[]
  metadata: {
    totalFiles: number
    languages: string[]
    summary: string
    promptTokens: number
    candidateTokens: number
    totalTokens: number
  }
}

interface ArchitectureGraphProps {
  data: AnalysisResponse | null
}

/* Language palette — kept rich but harmonised with paper background */
const LANGUAGE_COLORS: Record<string, { stripe: string; chipBg: string; chipText: string }> = {
  typescript: { stripe: '#3178C6', chipBg: '#E1ECFA', chipText: '#1F4F90' },
  javascript: { stripe: '#D9B500', chipBg: '#FCF4D6', chipText: '#7A6500' },
  python:     { stripe: '#3776AB', chipBg: '#E0ECF6', chipText: '#23517E' },
  go:         { stripe: '#00ADD8', chipBg: '#D8F2F8', chipText: '#016B85' },
  java:       { stripe: '#B07219', chipBg: '#F4E6D1', chipText: '#7A4D11' },
  rust:       { stripe: '#A66E3F', chipBg: '#F1E0CF', chipText: '#73492A' },
  cpp:        { stripe: '#00599C', chipBg: '#D6E4F0', chipText: '#053964' },
  c:          { stripe: '#555555', chipBg: '#E0E0E0', chipText: '#333333' },
  csharp:     { stripe: '#68217A', chipBg: '#EDDCF1', chipText: '#481354' },
  ruby:       { stripe: '#CC342D', chipBg: '#F7D9D7', chipText: '#8A211C' },
  php:        { stripe: '#777BB4', chipBg: '#E5E6F1', chipText: '#4D5081' },
  swift:      { stripe: '#F05138', chipBg: '#FBDCD3', chipText: '#A33724' },
  kotlin:     { stripe: '#7F52FF', chipBg: '#E4DAFE', chipText: '#5837B5' },
  scala:      { stripe: '#DC322F', chipBg: '#F7D6D5', chipText: '#931E1C' },
}

const TYPE_ICONS = {
  function: Zap,
  class: Box,
  module: Layers,
  interface: FileCode,
  file: File,
} as const

type CustomNodeData = {
  label: string
  type: string
  language: string
  summary: string
  inCount: number
  outCount: number
  isHighlighted?: boolean
  isDimmed?: boolean
}

type CustomNode = Node<CustomNodeData, 'custom'>

const NODE_WIDTH = 280
const NODE_MIN_HEIGHT = 120
const LAYER_X_GAP = 340
const LAYER_Y_GAP = 200

/* Sugiyama-style layered layout — keeps directed graphs readable. */
function layoutNodes(
  inNodes: AnalysisNode[],
  inEdges: AnalysisEdge[]
): Map<string, { x: number; y: number }> {
  const ids = inNodes.map(n => n.id)
  const idSet = new Set(ids)
  const succ = new Map<string, string[]>()
  const pred = new Map<string, string[]>()
  ids.forEach(id => {
    succ.set(id, [])
    pred.set(id, [])
  })
  inEdges.forEach(e => {
    if (idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to) {
      succ.get(e.from)!.push(e.to)
      pred.get(e.to)!.push(e.from)
    }
  })

  /* Layer assignment via longest path from "sources" — cycle-tolerant DFS with memoisation. */
  const layer = new Map<string, number>()
  const onStack = new Set<string>()
  const compute = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!
    if (onStack.has(id)) return 0
    onStack.add(id)
    const preds = pred.get(id) ?? []
    let best = 0
    for (const p of preds) {
      best = Math.max(best, compute(p) + 1)
    }
    onStack.delete(id)
    layer.set(id, best)
    return best
  }
  ids.forEach(compute)

  /* Bucket by layer. */
  const layerBuckets = new Map<number, string[]>()
  layer.forEach((l, id) => {
    if (!layerBuckets.has(l)) layerBuckets.set(l, [])
    layerBuckets.get(l)!.push(id)
  })
  const sortedLayers = Array.from(layerBuckets.keys()).sort((a, b) => a - b)

  /* Barycentric ordering — sort within each layer by avg predecessor x. */
  const positions = new Map<string, { x: number; y: number }>()
  sortedLayers.forEach(l => {
    const layerIds = layerBuckets.get(l)!
    if (l === 0) {
      // Stable order by node id for top layer
      layerIds.sort((a, b) => a.localeCompare(b))
    } else {
      layerIds.sort((a, b) => {
        const aPreds = pred.get(a) ?? []
        const bPreds = pred.get(b) ?? []
        const avg = (arr: string[]) => {
          if (!arr.length) return 0
          let sum = 0
          let count = 0
          for (const p of arr) {
            const pos = positions.get(p)
            if (pos) { sum += pos.x; count++ }
          }
          return count ? sum / count : 0
        }
        return avg(aPreds) - avg(bPreds)
      })
    }
    const totalWidth = (layerIds.length - 1) * LAYER_X_GAP
    layerIds.forEach((id, i) => {
      positions.set(id, {
        x: i * LAYER_X_GAP - totalWidth / 2,
        y: l * LAYER_Y_GAP,
      })
    })
  })

  /* Center the whole graph around origin. */
  let minX = Infinity, maxX = -Infinity
  positions.forEach(p => { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x })
  const offsetX = -(minX + maxX) / 2
  positions.forEach((p, k) => positions.set(k, { x: p.x + offsetX, y: p.y }))
  return positions
}

function CustomNodeComponent({ data, selected }: { data: CustomNodeData; selected?: boolean }) {
  const colors = LANGUAGE_COLORS[data.language] || LANGUAGE_COLORS.javascript
  const Icon = (TYPE_ICONS as Record<string, typeof Zap>)[data.type] || File

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-ink !w-2 !h-2 !border-2 !border-paper-50"
      />
      <motion.div
        className={clsx(
          'relative bg-paper-50 rounded-2xl overflow-hidden transition-all duration-200',
          'border',
          selected
            ? 'border-ink shadow-paper-lg ring-2 ring-vermillion/40'
            : data.isHighlighted
              ? 'border-ink/60 shadow-paper-lg'
              : 'border-paper-200 shadow-paper hover:border-ink/30',
          data.isDimmed && 'opacity-35'
        )}
        style={{ width: NODE_WIDTH, minHeight: NODE_MIN_HEIGHT }}
        whileHover={{ y: -2 }}
      >
        {/* Language color stripe down the left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: colors.stripe }}
        />

        <div className="pl-5 pr-4 pt-4 pb-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${colors.stripe}18`, color: colors.stripe }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
              </div>
              <p className="font-semibold text-sm text-ink truncate" title={data.label}>
                {data.label}
              </p>
            </div>
            <span
              className="label-mono flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] tracking-widest"
              style={{ background: colors.chipBg, color: colors.chipText }}
            >
              {data.language.slice(0, 4)}
            </span>
          </div>

          <p className="label-mono text-ink-mute mb-2 text-[10px]">
            ◇ {data.type}
          </p>

          {data.summary && (
            <p className="text-xs leading-relaxed text-ink-soft line-clamp-3">
              {data.summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-paper-200/70">
            <span className="flex items-center gap-1 text-[10px] text-ink-mute">
              <span className="w-1 h-1 rounded-full bg-kelp" />
              <span className="font-mono">{data.inCount}</span> in
            </span>
            <span className="flex items-center gap-1 text-[10px] text-ink-mute">
              <span className="w-1 h-1 rounded-full bg-vermillion" />
              <span className="font-mono">{data.outCount}</span> out
            </span>
            <span className="label-mono ml-auto text-ink-faint text-[9px]">tap →</span>
          </div>
        </div>
      </motion.div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-ink !w-2 !h-2 !border-2 !border-paper-50"
      />
    </>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNodeComponent as unknown as NodeTypes['custom'],
}

export default function ArchitectureGraph({ data }: ArchitectureGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoveredEdgeLabel, setHoveredEdgeLabel] = useState<string | null>(null)

  /* Stats derived from data */
  const stats = useMemo(() => {
    if (!data) return { fns: 0, classes: 0, modules: 0, ifaces: 0, files: 0 }
    return data.nodes.reduce(
      (acc, n) => {
        if (n.type === 'function') acc.fns++
        else if (n.type === 'class') acc.classes++
        else if (n.type === 'module') acc.modules++
        else if (n.type === 'interface') acc.ifaces++
        else if (n.type === 'file') acc.files++
        return acc
      },
      { fns: 0, classes: 0, modules: 0, ifaces: 0, files: 0 }
    )
  }, [data])

  /* In/out degree map */
  const degrees = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>()
    if (!data) return map
    data.nodes.forEach(n => map.set(n.id, { in: 0, out: 0 }))
    data.edges.forEach(e => {
      if (map.has(e.from)) map.get(e.from)!.out++
      if (map.has(e.to)) map.get(e.to)!.in++
    })
    return map
  }, [data])

  useEffect(() => {
    if (!data) return

    const layoutPositions = layoutNodes(data.nodes, data.edges)

    const flowNodes: CustomNode[] = data.nodes.map((node, index) => {
      const pos = layoutPositions.get(node.id) ?? { x: index * 340, y: 0 }
      const deg = degrees.get(node.id) ?? { in: 0, out: 0 }
      return {
        id: node.id,
        type: 'custom',
        position: pos,
        data: {
          label: node.label,
          type: node.type,
          language: node.language,
          summary: node.summary,
          inCount: deg.in,
          outCount: deg.out,
        },
      }
    })

    const flowEdges: Edge[] = data.edges.map((edge, index) => ({
      id: `e-${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2A3447', strokeWidth: 1.6, strokeDasharray: '6 4' },
      labelStyle: { fill: '#2A3447', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 6,
      labelBgStyle: { fill: '#FBF7EE', stroke: '#EAE0C9', strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#2A3447', width: 16, height: 16 },
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [data, setNodes, setEdges, degrees])

  /* Highlight neighborhood of selected node */
  useEffect(() => {
    if (!data) return
    if (!selectedNodeId) {
      setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, isHighlighted: false, isDimmed: false } })))
      setEdges(prev => prev.map(e => ({ ...e, style: { ...e.style, opacity: 1, strokeWidth: 1.6, stroke: '#2A3447' } })))
      return
    }
    const connected = new Set<string>([selectedNodeId])
    data.edges.forEach(e => {
      if (e.from === selectedNodeId) connected.add(e.to)
      if (e.to === selectedNodeId) connected.add(e.from)
    })
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: {
          ...n.data,
          isHighlighted: n.id === selectedNodeId,
          isDimmed: !connected.has(n.id),
        },
      }))
    )
    setEdges(prev =>
      prev.map(e => {
        const involved = e.source === selectedNodeId || e.target === selectedNodeId
        return {
          ...e,
          style: {
            ...e.style,
            opacity: involved ? 1 : 0.18,
            strokeWidth: involved ? 2.4 : 1.4,
            stroke: involved ? '#E25822' : '#2A3447',
          },
        }
      })
    )
  }, [selectedNodeId, setNodes, setEdges, data])

  const onNodeClick = useCallback((_: React.MouseEvent, node: CustomNode) => {
    setSelectedNodeId(node.id)
    setShowDetail(true)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setShowDetail(false)
  }, [])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
    setTimeout(() => setSelectedNodeId(null), 300)
  }, [])

  const handleExport = useCallback(() => {
    if (!data) return
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'architecture-analysis.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null),
    [nodes, selectedNodeId]
  )

  const selectedConnections = useMemo(() => {
    if (!selectedNode || !data) return []
    return data.edges
      .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
      .map(e => {
        const isOutgoing = e.from === selectedNode.id
        const otherId = isOutgoing ? e.to : e.from
        const otherNode = data.nodes.find(n => n.id === otherId)
        return {
          direction: isOutgoing ? 'out' as const : 'in' as const,
          label: e.label,
          other: otherNode,
        }
      })
  }, [selectedNode, data])

  if (!data) return null

  const containerClass = clsx(
    'relative rounded-3xl overflow-hidden transition-all duration-500',
    isFullscreen
      ? 'fixed inset-4 z-50 shadow-paper-lg'
      : 'w-full shadow-paper border border-paper-200'
  )

  return (
    <div className="space-y-6">
      {/* === PROJECT SUMMARY CARD === */}
      <div className="paper-card rounded-3xl overflow-hidden">
        <div className="p-7 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-7">
            {/* Left: title + summary */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="label-mono text-vermillion">◐ Project Brief</span>
                <span className="label-mono text-ink-faint">·</span>
                <span className="label-mono text-ink-mute">Generated by Gemini</span>
              </div>
              <h2 className="serif-italic text-4xl lg:text-5xl text-ink leading-[1.05] mb-4">
                The architecture, in a glance.
              </h2>
              <p className="text-base text-ink-soft leading-relaxed max-w-2xl">
                {data.metadata.summary || 'No summary available for this codebase.'}
              </p>
            </div>

            {/* Right: stat tiles */}
            <div className="grid grid-cols-2 gap-3 lg:w-72">
              <StatTile
                label="Files"
                value={data.metadata.totalFiles}
                icon={<File className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="Nodes"
                value={data.nodes.length}
                icon={<Hash className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="Edges"
                value={data.edges.length}
                icon={<GitBranch className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="Languages"
                value={data.metadata.languages.length}
                icon={<Workflow className="w-3.5 h-3.5" />}
              />
              <div className="col-span-2">
                <div className="bg-paper border border-paper-200 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-vermillion" />
                    <span className="label-mono text-ink-mute">AI Context</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="label-mono text-[10px] text-ink-faint">Prompt</p>
                      <p className="font-mono text-sm font-bold text-ink">{data.metadata.promptTokens?.toLocaleString() || 0}</p>
                    </div>
                    <div className="w-px h-8 bg-paper-200" />
                    <div className="text-right">
                      <p className="label-mono text-[10px] text-ink-faint">Tokens</p>
                      <p className="font-mono text-sm font-bold text-vermillion">{data.metadata.totalTokens?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Composition bar */}
          <div className="mt-6 pt-6 border-t border-paper-200/70">
            <div className="flex items-center justify-between mb-2.5">
              <p className="label-mono text-ink-mute">Composition</p>
              <p className="label-mono text-ink-faint">
                {data.metadata.languages.join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {stats.fns > 0 && <CompChip count={stats.fns} label="functions" color="#0F9D8B" />}
              {stats.classes > 0 && <CompChip count={stats.classes} label="classes" color="#E25822" />}
              {stats.modules > 0 && <CompChip count={stats.modules} label="modules" color="#F59E0B" />}
              {stats.ifaces > 0 && <CompChip count={stats.ifaces} label="interfaces" color="#3178C6" />}
              {stats.files > 0 && <CompChip count={stats.files} label="files" color="#6B7280" />}
            </div>
          </div>
        </div>
      </div>

      {/* === CANVAS === */}
      <div
        className={containerClass}
        style={!isFullscreen ? { height: 'min(85vh, 880px)' } : undefined}
      >
        {/* Header bar — floats over canvas */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="paper-card rounded-2xl px-5 py-3 flex items-center gap-3 pointer-events-auto">
            <div className="w-9 h-9 bg-ink text-paper-50 rounded-xl flex items-center justify-center">
              <Workflow className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-sm text-ink">Architecture Map</p>
              <p className="label-mono text-ink-mute">
                {data.nodes.length} nodes · {data.edges.length} edges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={handleExport}
              className="paper-card rounded-xl p-3 hover:bg-paper-100 transition-colors"
              title="Export JSON"
            >
              <Download className="w-4 h-4 text-ink-soft" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="paper-card rounded-xl p-3 hover:bg-paper-100 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-ink-soft" /> : <Maximize2 className="w-4 h-4 text-ink-soft" />}
            </button>
          </div>
        </div>

        {/* Bottom-left hint chip */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <div className="paper-card rounded-xl px-3.5 py-2.5 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-vermillion" />
            <p className="label-mono text-ink-mute">
              Click a node to inspect · drag to rearrange · scroll to zoom
            </p>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeLabel(String(edge.label ?? ''))}
          onEdgeMouseLeave={() => setHoveredEdgeLabel(null)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.1, minZoom: 0.2 }}
          minZoom={0.15}
          maxZoom={2.5}
          className="paper-texture"
          defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.3}
            color="rgba(14,21,37,0.18)"
          />
          <Controls
            showInteractive={false}
            className="!shadow-paper !border !border-paper-200"
          />
          <MiniMap
            nodeColor={(node) => {
              const nd = node.data as CustomNodeData | undefined
              return LANGUAGE_COLORS[nd?.language || '']?.stripe || '#6B7280'
            }}
            maskColor="rgba(251, 247, 238, 0.85)"
            pannable
            zoomable
            style={{ borderRadius: '12px' }}
          />
        </ReactFlow>

        {/* Hovered edge label floater */}
        <AnimatePresence>
          {hoveredEdgeLabel && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none paper-card px-3 py-1.5 rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <span className="label-mono text-vermillion">→ {hoveredEdgeLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* === DETAIL PANEL === */}
      <AnimatePresence>
        {showDetail && selectedNode && (
          <>
            <motion.div
              className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetail}
            />

            <motion.div
              className="fixed right-6 top-6 bottom-6 w-[440px] max-w-[calc(100vw-3rem)] paper-card rounded-3xl z-50 overflow-hidden flex flex-col"
              initial={{ opacity: 0, x: 80, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
            >
              <DetailHeader
                data={selectedNode.data}
                onClose={closeDetail}
              />

              <div className="flex-1 overflow-y-auto detail-scroll px-7 py-6 space-y-7">
                {/* Summary section */}
                <section>
                  <p className="label-mono text-ink-mute mb-3">◇ Summary</p>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    {selectedNode.data.summary || 'No summary available for this component.'}
                  </p>
                </section>

                {/* Degree pills */}
                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-kelp-50 border border-kelp/20 rounded-xl p-3.5">
                    <p className="label-mono text-kelp mb-1.5">Incoming</p>
                    <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                      {selectedNode.data.inCount}
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">callers / dependents</p>
                  </div>
                  <div className="bg-vermillion-50 border border-vermillion/20 rounded-xl p-3.5">
                    <p className="label-mono text-vermillion mb-1.5">Outgoing</p>
                    <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                      {selectedNode.data.outCount}
                    </p>
                    <p className="text-[11px] text-ink-mute mt-0.5">calls / dependencies</p>
                  </div>
                </section>

                {/* Connections list */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p className="label-mono text-ink-mute">◇ Connections</p>
                    <span className="label-mono text-ink-faint">{selectedConnections.length} total</span>
                  </div>
                  {selectedConnections.length === 0 ? (
                    <p className="text-sm text-ink-faint italic text-center py-6">
                      This node stands on its own.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedConnections.map((conn, i) => {
                        const otherLang = conn.other?.language ?? ''
                        const stripeColor = LANGUAGE_COLORS[otherLang]?.stripe ?? '#6B7280'
                        return (
                          <motion.button
                            key={i}
                            onClick={() => conn.other && setSelectedNodeId(conn.other.id)}
                            className="w-full text-left flex items-start gap-3 p-3 bg-paper hover:bg-paper-100 border border-paper-200 hover:border-ink/20 rounded-xl transition-all"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <div
                              className={clsx(
                                'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-paper-50',
                                conn.direction === 'out' ? 'bg-vermillion' : 'bg-kelp'
                              )}
                            >
                              <ChevronRight className={clsx('w-3.5 h-3.5', conn.direction === 'in' && 'rotate-180')} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="label-mono text-ink-mute text-[10px]">
                                  {conn.direction === 'out' ? 'calls' : 'called by'}
                                </span>
                                <span className="label-mono text-[10px] px-1.5 py-0.5 rounded bg-paper-100 text-ink-soft">
                                  {conn.label}
                                </span>
                              </div>
                              <p className="font-medium text-sm text-ink truncate">
                                {conn.other?.label ?? 'Unknown'}
                              </p>
                              {conn.other?.summary && (
                                <p className="text-[11px] text-ink-mute mt-0.5 line-clamp-2">
                                  {conn.other.summary}
                                </p>
                              )}
                            </div>
                            <div
                              className="w-1 self-stretch rounded-full"
                              style={{ background: stripeColor }}
                            />
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-paper border border-paper-200 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="label-mono text-ink-mute">{label}</span>
        <span className="text-ink-faint">{icon}</span>
      </div>
      <p className="font-mono text-2xl font-bold text-ink tabular-nums leading-tight">{value}</p>
    </div>
  )
}

function CompChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-paper border border-paper-200">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-xs font-semibold text-ink tabular-nums">{count}</span>
      <span className="text-xs text-ink-mute">{label}</span>
    </span>
  )
}

function DetailHeader({ data, onClose }: { data: CustomNodeData; onClose: () => void }) {
  const colors = LANGUAGE_COLORS[data.language] || LANGUAGE_COLORS.javascript
  const Icon = (TYPE_ICONS as Record<string, typeof Zap>)[data.type] || File
  return (
    <div
      className="relative px-7 pt-6 pb-5 border-b border-paper-200"
      style={{ background: `linear-gradient(180deg, ${colors.chipBg} 0%, transparent 120%)` }}
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: colors.stripe }} />
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-lg hover:bg-paper-100 transition-colors"
      >
        <X className="w-4 h-4 text-ink-soft" />
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: colors.stripe, color: '#FBF7EE' }}
        >
          <Icon className="w-5 h-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="label-mono text-ink-mute mb-0.5">
            {data.type} · {data.language}
          </p>
          <h3 className="serif-italic text-2xl text-ink truncate" title={data.label}>
            {data.label}
          </h3>
        </div>
      </div>
    </div>
  )
}
