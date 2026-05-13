'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface NeuralPulseProps {
  isActive: boolean
  onComplete?: () => void
}

type Token = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  vr: number
  label: string
  hue: 'kelp' | 'vermillion' | 'amber' | 'ink'
  popping?: boolean
}

type Pop = { id: number; x: number; y: number; label: string }

const LANG_LABELS = ['TS', 'GO', 'PY', 'JS', 'JAVA', 'RS', 'CPP', 'KT', 'RB', 'SWIFT', '{ }', '< />', '=>', '#@', '::']

const PHASES = [
  { label: 'Cracking the archive', detail: 'Reading source files into memory', minPct: 0, maxPct: 18 },
  { label: 'Parsing structures', detail: 'Identifying functions, classes, and modules', minPct: 18, maxPct: 42 },
  { label: 'Mapping dependencies', detail: 'Tracing calls and imports across the tree', minPct: 42, maxPct: 68 },
  { label: 'Composing the blueprint', detail: 'Gemini is drafting the architecture map', minPct: 68, maxPct: 90 },
  { label: 'Finishing touches', detail: 'Annotating nodes and writing summaries', minPct: 90, maxPct: 99 },
]

const HUE_COLORS = {
  kelp: { bg: '#0F9D8B', soft: 'rgba(15,157,139,0.18)' },
  vermillion: { bg: '#E25822', soft: 'rgba(226,88,34,0.20)' },
  amber: { bg: '#F59E0B', soft: 'rgba(245,158,11,0.20)' },
  ink: { bg: '#A4ACBE', soft: 'rgba(164,172,190,0.20)' },
} as const

export default function NeuralPulse({ isActive }: NeuralPulseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenIdRef = useRef(0)
  const popIdRef = useRef(0)
  const [tokens, setTokens] = useState<Token[]>([])
  const [pops, setPops] = useState<Pop[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(0)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Compute current phase
  const phaseIndex = PHASES.findIndex(p => progress >= p.minPct && progress < p.maxPct)
  const phase = PHASES[phaseIndex >= 0 ? phaseIndex : PHASES.length - 1]

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setContainerSize({ w: rect.width, h: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [isActive])

  // Elapsed timer + simulated progress (real progress can override later)
  useEffect(() => {
    if (!isActive) {
      setElapsed(0)
      setProgress(0)
      setScore(0)
      setCombo(0)
      setTokens([])
      return
    }
    const start = Date.now()
    const id = window.setInterval(() => {
      const t = (Date.now() - start) / 1000
      setElapsed(t)
      // Asymptotic curve toward 92% — true completion comes from parent unmount
      const target = 92 * (1 - Math.exp(-t / 18))
      setProgress(prev => Math.max(prev, Math.min(target, 92)))
    }, 200)
    return () => window.clearInterval(id)
  }, [isActive])

  // Spawn tokens
  useEffect(() => {
    if (!isActive || containerSize.w === 0) return
    const spawn = () => {
      setTokens(prev => {
        if (prev.length >= 14) return prev
        const hues: Token['hue'][] = ['kelp', 'vermillion', 'amber', 'ink']
        const newToken: Token = {
          id: tokenIdRef.current++,
          x: Math.random() * (containerSize.w - 80) + 40,
          y: containerSize.h + 40,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.4 + Math.random() * 0.6),
          size: 44 + Math.random() * 28,
          rotation: (Math.random() - 0.5) * 30,
          vr: (Math.random() - 0.5) * 0.4,
          label: LANG_LABELS[Math.floor(Math.random() * LANG_LABELS.length)],
          hue: hues[Math.floor(Math.random() * hues.length)],
        }
        return [...prev, newToken]
      })
    }
    spawn()
    const id = window.setInterval(spawn, 950)
    return () => window.clearInterval(id)
  }, [isActive, containerSize])

  // Animate tokens (drift upward and gently sway)
  useEffect(() => {
    if (!isActive) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      setTokens(prev =>
        prev
          .map(t => {
            const sway = Math.sin(now / 800 + t.id) * 0.15
            return {
              ...t,
              x: t.x + (t.vx + sway) * dt,
              y: t.y + t.vy * dt,
              rotation: t.rotation + t.vr * dt,
            }
          })
          .filter(t => t.y > -100 && !t.popping)
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isActive])

  // Combo reset timer
  useEffect(() => {
    if (combo === 0) return
    const id = window.setTimeout(() => setCombo(0), 1400)
    return () => window.clearTimeout(id)
  }, [combo])

  const popToken = useCallback((token: Token) => {
    setTokens(prev => prev.filter(t => t.id !== token.id))
    const popId = popIdRef.current++
    setPops(prev => [...prev, { id: popId, x: token.x, y: token.y, label: token.label }])
    window.setTimeout(() => {
      setPops(prev => prev.filter(p => p.id !== popId))
    }, 600)
    setCombo(c => c + 1)
    setScore(s => s + 10 + Math.min(combo * 2, 30))
  }, [combo])

  // Background constellation — nodes that progressively appear
  const constellationNodes = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const radius = 140 + (i % 3) * 40
    return {
      i,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      visible: progress > (i / 12) * 88,
    }
  })

  if (!isActive) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full paper-texture overflow-hidden select-none border-t border-paper-200"
    >
      {/* Vignette + warm gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(226, 88, 34, 0.03) 60%, rgba(234, 224, 201, 0.3) 100%)',
        }}
      />

      {/* Background constellation that builds up with progress */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <g transform={`translate(${containerSize.w / 2}, ${containerSize.h / 2})`}>
          {/* connecting lines */}
          {constellationNodes.map((node, i) => {
            const next = constellationNodes[(i + 1) % constellationNodes.length]
            if (!node.visible || !next.visible) return null
            return (
              <motion.line
                key={`l-${i}`}
                x1={node.x}
                y1={node.y}
                x2={next.x}
                y2={next.y}
                stroke="rgba(14,21,37,0.15)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
              />
            )
          })}
          {/* nodes */}
          {constellationNodes.map(node => (
            <motion.g key={`n-${node.i}`}>
              {node.visible && (
                <>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={4}
                    fill="#2A3447"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                  />
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={14}
                    fill="none"
                    stroke="rgba(14,21,37,0.1)"
                    strokeWidth="1"
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                </>
              )}
            </motion.g>
          ))}
        </g>
      </svg>

      {/* Center compass — rotating + breathing */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          <svg width="320" height="320" viewBox="-160 -160 320 320">
            {/* outer ring */}
            <circle cx="0" cy="0" r="140" fill="none" stroke="rgba(14,21,37,0.08)" strokeWidth="1" strokeDasharray="2 6" />
            <circle cx="0" cy="0" r="100" fill="none" stroke="rgba(226,88,34,0.12)" strokeWidth="1" />
            <circle cx="0" cy="0" r="60" fill="none" stroke="rgba(14,21,37,0.06)" strokeWidth="1" strokeDasharray="4 4" />
            {/* compass crosshair */}
            <line x1="-140" y1="0" x2="140" y2="0" stroke="rgba(14,21,37,0.05)" strokeWidth="1" />
            <line x1="0" y1="-140" x2="0" y2="140" stroke="rgba(14,21,37,0.05)" strokeWidth="1" />
            {/* tick marks */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * Math.PI * 2
              const x1 = Math.cos(a) * 134
              const y1 = Math.sin(a) * 134
              const x2 = Math.cos(a) * 140
              const y2 = Math.sin(a) * 140
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(14,21,37,0.12)" strokeWidth="1" />
            })}
          </svg>
        </motion.div>

        {/* counter-rotating inner gear */}
        <motion.div
          className="absolute"
          animate={{ rotate: -360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        >
          <svg width="100" height="100" viewBox="-50 -50 100 100">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2
              const x = Math.cos(a) * 28
              const y = Math.sin(a) * 28
              return (
                <rect
                  key={i}
                  x={-3}
                  y={-3}
                  width="6"
                  height="6"
                  fill="#E25822"
                  opacity="0.6"
                  transform={`translate(${x}, ${y}) rotate(${(i / 8) * 360})`}
                />
              )
            })}
            <circle cx="0" cy="0" r="18" fill="none" stroke="rgba(226,88,34,0.6)" strokeWidth="1.5" />
          </svg>
        </motion.div>

        {/* Center pulsing dot */}
        <motion.div
          className="absolute w-3 h-3 rounded-full"
          style={{ background: '#E25822', boxShadow: '0 0 24px rgba(226,88,34,0.8)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      </div>

      {/* Top status — phase title */}
      <div className="absolute top-10 left-0 right-0 flex justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase.label}
            className="text-center"
            initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
            transition={{ duration: 0.5 }}
          >
            <p className="label-mono text-vermillion mb-2">
              ◐ Phase {phaseIndex + 1} of {PHASES.length}
            </p>
            <h3 className="serif-italic text-4xl text-ink mb-1">
              {phase.label}
            </h3>
            <p className="text-sm text-ink-soft">{phase.detail}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating tokens — clickable for fun */}
      <div className="absolute inset-0 pointer-events-none">
        {tokens.map(token => {
          const color = HUE_COLORS[token.hue]
          return (
            <motion.button
              key={token.id}
              onClick={() => popToken(token)}
              className="absolute pointer-events-auto flex items-center justify-center rounded-2xl font-mono font-semibold text-paper-50 cursor-pointer"
              style={{
                left: token.x,
                top: token.y,
                width: token.size,
                height: token.size,
                background: color.bg,
                boxShadow: `0 8px 32px ${color.soft}, inset 0 -3px 0 rgba(14,21,37,0.1)`,
                transform: `translate(-50%, -50%) rotate(${token.rotation}deg)`,
                fontSize: token.size * 0.28,
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.85 }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              {token.label}
            </motion.button>
          )
        })}

        {/* Pop confetti */}
        {pops.map(pop => (
          <div
            key={pop.id}
            className="absolute pointer-events-none"
            style={{ left: pop.x, top: pop.y, transform: 'translate(-50%, -50%)' }}
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2
              const dist = 40 + Math.random() * 30
              return (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    background: i % 3 === 0 ? '#E25822' : i % 3 === 1 ? '#0F9D8B' : '#F59E0B',
                    left: 0,
                    top: 0,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.4,
                  }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              )
            })}
            <motion.div
              className="absolute -translate-x-1/2 -translate-y-1/2 label-mono text-ink-soft whitespace-nowrap"
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -30, scale: 1.2 }}
              transition={{ duration: 0.6 }}
            >
              +{10 + Math.min(combo * 2, 30)}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Score chip — top right */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <motion.div
          className="px-4 py-2.5 rounded-xl bg-paper-50/95 backdrop-blur border border-paper-200/30"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="label-mono text-ink-mute">Score</p>
          <p className="font-mono text-xl font-bold text-ink leading-tight tabular-nums">{score}</p>
        </motion.div>
        {combo > 1 && (
          <motion.div
            key={combo}
            className="px-3 py-2 rounded-xl bg-vermillion text-paper-50"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <p className="label-mono">×{combo} combo</p>
          </motion.div>
        )}
      </div>

      {/* Hint chip — top left */}
      <motion.div
        className="absolute top-6 left-6 px-4 py-2.5 rounded-xl bg-paper-50/40 backdrop-blur-sm border border-paper-200/50 max-w-xs"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="label-mono text-vermillion mb-1">◇ While you wait</p>
        <p className="text-sm text-ink-soft leading-snug">
          Pop the floating code tokens for points. Big bundles take longer to map.
        </p>
      </motion.div>

      {/* Bottom progress strip */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="label-mono text-ink-mute">
              {Math.round(progress)}% · {elapsed.toFixed(1)}s elapsed
            </p>
            <p className="label-mono text-ink-mute">
              {tokens.length} tokens drifting
            </p>
          </div>
          <div className="relative h-1.5 bg-paper-200 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, #E25822 0%, #F59E0B 50%, #0F9D8B 100%)',
              }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-3">
            {PHASES.map((p, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <div
                  className={`h-0.5 w-full rounded-full transition-colors duration-500 ${
                    progress >= p.maxPct
                      ? 'bg-kelp'
                      : progress >= p.minPct
                        ? 'bg-vermillion'
                        : 'bg-paper-200'
                  }`}
                />
                <p
                  className={`label-mono text-[9px] truncate transition-colors ${
                    progress >= p.minPct ? 'text-ink-soft' : 'text-ink-faint'
                  }`}
                >
                  0{i + 1} · {p.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
