'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileCode, X, Github, Link2, Loader2, FolderOpen, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'

type TabType = 'upload' | 'github'

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void
  onGitHubUrlSubmit?: (url: string) => void
  isLoading: boolean
}

interface DriftToken {
  id: number
  x: number
  y: number
  label: string
  delay: number
}

const TOKEN_LABELS = ['main.go', 'app.tsx', '__init__.py', 'index.js', 'lib.rs', 'Pod.swift', 'core.kt', 'auth.ts']

export default function DropZone({ onFilesSelected, onGitHubUrlSubmit, isLoading }: DropZoneProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [isDragOver, setIsDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [githubUrl, setGithubUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const tokenIdRef = useRef(0)
  const [tokens, setTokens] = useState<DriftToken[]>([])

  /* Slow background drift tokens to give the surface life without being twitchy */
  useEffect(() => {
    setTokens(
      Array.from({ length: 7 }, () => ({
        id: tokenIdRef.current++,
        x: Math.random() * 100,
        y: Math.random() * 100,
        label: TOKEN_LABELS[Math.floor(Math.random() * TOKEN_LABELS.length)],
        delay: Math.random() * 4,
      }))
    )
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const codeFiles = droppedFiles.filter(file => {
      const ext = file.name.toLowerCase()
      return /\.(ts|tsx|js|jsx|py|go|java|rs|cpp|c|cs|rb|php|swift|kt|scala)$/.test(ext)
    })

    if (codeFiles.length > 0) {
      setFiles(codeFiles)
      onFilesSelected(codeFiles)
    }
  }, [onFilesSelected])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      onFilesSelected(selectedFiles)
    }
  }, [onFilesSelected])

  const clearFiles = useCallback(() => {
    setFiles([])
  }, [])

  const handleGitHubSubmit = useCallback(async () => {
    if (!githubUrl.trim()) return

    setIsFetching(true)
    setGithubError(null)

    try {
      if (onGitHubUrlSubmit) {
        await onGitHubUrlSubmit(githubUrl.trim())
      }
      setGithubUrl('')
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to fetch repository')
    } finally {
      setIsFetching(false)
    }
  }, [githubUrl, onGitHubUrlSubmit])

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* === Tab switcher — newspaper style === */}
      <div className="flex items-center justify-center mb-8">
        <div className="inline-flex items-center gap-0.5 p-1 rounded-2xl bg-paper-100 border border-paper-200">
          <TabButton
            active={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
            icon={<Upload className="w-3.5 h-3.5" />}
            label="Drop files"
          />
          <TabButton
            active={activeTab === 'github'}
            onClick={() => setActiveTab('github')}
            icon={<Github className="w-3.5 h-3.5" />}
            label="From GitHub"
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'upload' ? (
          <motion.div
            key="upload"
            className={clsx(
              'relative rounded-3xl border-2 transition-all duration-500 overflow-hidden',
              'paper-card',
              isDragOver
                ? 'border-vermillion scale-[1.01]'
                : 'border-paper-200 border-dashed'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
          >
            {/* Blueprint grid pattern */}
            <div className="absolute inset-0 blueprint-grid opacity-60 pointer-events-none" />

            {/* Drifting filename tokens */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {tokens.map((tok) => (
                <motion.div
                  key={tok.id}
                  className="absolute label-mono text-ink-faint/40"
                  style={{ left: `${tok.x}%`, top: `${tok.y}%` }}
                  animate={{
                    y: [0, -12, 0],
                    x: [0, 6, 0],
                    opacity: [0.25, 0.5, 0.25],
                  }}
                  transition={{
                    duration: 8 + tok.id,
                    delay: tok.delay,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {tok.label}
                </motion.div>
              ))}
            </div>

            {/* Vermillion ink-bleed glow when dragging */}
            {isDragOver && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(226,88,34,0.12) 0%, transparent 60%)',
                }}
              />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center py-20 px-8">
              {/* Iconography stack */}
              <motion.div
                className="relative mb-8"
                animate={{ scale: isDragOver ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Outer ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: isDragOver ? '#E25822' : '#A4ACBE' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Inner card */}
                  <motion.div
                    className="relative w-16 h-16 rounded-xl bg-paper-50 border border-paper-200 flex items-center justify-center shadow-paper"
                    animate={{ y: isDragOver ? -4 : 0 }}
                  >
                    {isDragOver ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                      >
                        <FileCode className="w-7 h-7 text-vermillion" />
                      </motion.div>
                    ) : (
                      <FolderOpen className="w-7 h-7 text-ink-soft" />
                    )}
                  </motion.div>
                  {/* Corner brackets */}
                  <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-ink/40" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-ink/40" />
                  <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-ink/40" />
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-ink/40" />
                </div>
              </motion.div>

              <AnimatePresence mode="wait" initial={false}>
                {files.length > 0 ? (
                  <motion.div
                    key="files"
                    exit={{ opacity: 0, y: -12 }}
                    className="flex flex-col items-center"
                  >
                    <p className="label-mono text-kelp mb-3">◇ Ready to map</p>
                    <h3 className="serif-italic text-3xl text-ink mb-4">
                      {files.length} file{files.length > 1 ? 's' : ''} loaded
                    </h3>
                    <div className="flex flex-wrap gap-1.5 max-w-md justify-center mb-4">
                      {files.slice(0, 6).map((file, i) => (
                        <motion.span
                          key={file.name}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="label-mono px-2 py-1 rounded-md bg-paper border border-paper-200 text-ink-soft"
                        >
                          {file.name}
                        </motion.span>
                      ))}
                      {files.length > 6 && (
                        <span className="label-mono px-2 py-1 rounded-md bg-paper-100 text-ink-mute">
                          +{files.length - 6} more
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearFiles}
                      className="label-mono text-ink-mute hover:text-vermillion transition-colors flex items-center gap-1.5"
                    >
                      <X className="w-3 h-3" />
                      Clear and pick again
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="prompt"
                    exit={{ opacity: 0, y: -12 }}
                    className="text-center"
                  >
                    <p className="label-mono text-vermillion mb-3">◐ Step 01</p>
                    <h3 className="serif-italic text-4xl md:text-5xl text-ink mb-4 leading-tight">
                      Hand it the codebase.
                    </h3>
                    <p className="text-ink-mute mb-7 max-w-md mx-auto">
                      Drag your source files in, or click below to browse. We&apos;ll keep everything
                      in memory — nothing is written to disk.
                    </p>
                    <label className="cursor-pointer inline-block">
                      <span className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper-50 rounded-xl font-medium shadow-paper hover:bg-ink-soft hover:-translate-y-0.5 transition-all">
                        Browse files
                        <ArrowRight className="w-4 h-4" />
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".ts,.tsx,.js,.jsx,.py,.go,.java,.rs,.cpp,.c,.cs,.rb,.php,.swift,.kt,.scala"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                    <p className="label-mono text-ink-faint mt-5">
                      TS · JS · PY · GO · JAVA · RS · C / C++ · KT · SWIFT · RB · PHP
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="github"
            className="paper-card rounded-3xl p-10 relative overflow-hidden"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
          >
            <div className="absolute inset-0 blueprint-grid opacity-50 pointer-events-none" />

            <div className="relative flex flex-col items-center text-center">
              <div className="relative w-16 h-16 rounded-xl bg-ink text-paper-50 flex items-center justify-center mb-6 shadow-paper">
                <Github className="w-7 h-7" />
                <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-ink/40" />
                <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-ink/40" />
                <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-ink/40" />
                <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-ink/40" />
              </div>

              <p className="label-mono text-vermillion mb-3">◐ Step 01 · Remote</p>
              <h3 className="serif-italic text-4xl text-ink mb-3 leading-tight">
                Or pull from GitHub.
              </h3>
              <p className="text-ink-mute mb-7 max-w-md">
                Paste any public repository URL. We&apos;ll fetch the source tree and start mapping.
              </p>

              <div className="w-full max-w-xl">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGitHubSubmit()}
                      placeholder="github.com/username/repository"
                      className="w-full pl-11 pr-4 py-3.5 bg-paper-50 border border-paper-200 rounded-xl text-ink placeholder-ink-faint focus:border-ink focus:outline-none transition-colors font-mono text-sm"
                    />
                  </div>
                  <button
                    onClick={handleGitHubSubmit}
                    disabled={!githubUrl.trim() || isFetching}
                    className={clsx(
                      'px-5 py-3.5 rounded-xl font-medium transition-all duration-300',
                      'bg-ink text-paper-50 hover:bg-ink-soft',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'flex items-center gap-2 shadow-paper'
                    )}
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fetching
                      </>
                    ) : (
                      <>
                        Fetch
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {githubError && (
                    <motion.div
                      className="mt-4 p-3.5 bg-vermillion-50 border border-vermillion/20 rounded-xl text-vermillion-600 text-sm flex items-start gap-2"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{githubError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="mt-4 label-mono text-ink-faint">
                  Example · github.com/facebook/react
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local loading overlay (used briefly until parent switches to playground) */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-paper/85 backdrop-blur-sm rounded-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-vermillion animate-spin" />
            <p className="mt-3 label-mono text-ink-mute">Preparing the workshop…</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
        active ? 'text-paper-50' : 'text-ink-mute hover:text-ink'
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 bg-ink rounded-xl"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  )
}
