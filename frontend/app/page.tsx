'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, BookOpen, Compass, ArrowLeft, AlertTriangle } from 'lucide-react'
import DropZone from '@/components/DropZone/DropZone'
import NeuralPulse from '@/components/NeuralPulse/NeuralPulse'
import ArchitectureGraph from '@/components/ArchitectureGraph/ArchitectureGraph'

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
  }
}

type ViewKey = 'hero' | 'neural' | 'result'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNeural, setShowNeural] = useState(false)

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)
    setAnalysisData(null)
    setShowNeural(true)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://repogaze-190510194175.asia-southeast1.run.app'
      
      if (!process.env.NEXT_PUBLIC_API_URL) {
        console.log("Using hardcoded fallback API URL")
      }

      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const result = await response.json()
      setAnalysisData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze code')
    } finally {
      setIsLoading(false)
      setShowNeural(false)
    }
  }, [])

  const handleGitHubUrlSubmit = useCallback(async (url: string) => {
    setIsLoading(true)
    setError(null)
    setAnalysisData(null)
    setShowNeural(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://repogaze-190510194175.asia-southeast1.run.app'

      const fetchResponse = await fetch(`${apiUrl}/api/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json()
        throw new Error(errorData.error || 'Failed to fetch repository')
      }

      const { files } = await fetchResponse.json()

      const fileArray: File[] = []
      for (const [filename, content] of Object.entries(files)) {
        const blob = new Blob([content as string], { type: 'text/plain' })
        fileArray.push(new File([blob], filename))
      }

      if (fileArray.length === 0) {
        throw new Error('No code files found in repository')
      }

      const formData = new FormData()
      fileArray.forEach((file) => formData.append('files', file))

      const analysisResponse = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const result = await analysisResponse.json()
      setAnalysisData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository')
    } finally {
      setIsLoading(false)
      setShowNeural(false)
    }
  }, [])

  const resetAnalysis = useCallback(() => {
    setAnalysisData(null)
    setError(null)
    setIsLoading(false)
    setShowNeural(false)
  }, [])

  // Single view discriminator — never produces a blank slot.
  const view: ViewKey = showNeural ? 'neural' : analysisData ? 'result' : 'hero'

  return (
    <main className="min-h-screen paper-texture overflow-x-hidden">
      {/* === HEADER === */}
      <header className="relative z-10 px-6 lg:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-11 h-11 bg-ink text-paper-50 rounded-xl flex items-center justify-center shadow-paper">
                <Compass className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 border-vermillion" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-vermillion" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-ink tracking-tight leading-tight">
                Repo<span className="serif-italic text-vermillion">Gaze</span>
              </h1>
              <p className="label-mono text-ink-mute leading-tight">Architecture · Studio</p>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <a
              href="#how-it-works"
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-sm text-ink-soft hover:text-ink hover:bg-paper-100 rounded-xl transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>Docs</span>
            </a>
            <a
              href="https://github.com/"
              className="flex items-center gap-2 px-3.5 py-2 text-sm bg-ink text-paper-50 rounded-xl hover:bg-ink-soft transition-all shadow-paper"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </motion.div>
        </div>
      </header>

      {/* === MAIN VIEW SWITCHER === */}
      <section className="relative px-6 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          {view === 'hero' && (
            <div className="pt-12 pb-12">
              <div className="max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 bg-paper-50 border border-paper-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-kelp animate-pulse" />
                  <span className="label-mono text-ink-soft">
                    Powered by Gemini · Built for Google Challenge 2026
                  </span>
                </div>

                <h2 className="font-semibold text-4xl md:text-6xl tracking-tight text-ink mb-6 leading-[1.05]">
                  Understand any codebase{' '}
                  <span className="serif-italic text-vermillion">at a glance</span>.
                </h2>

                <p className="text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
                  RepoGaze turns tangled source trees into an annotated architectural map —
                  so you can trace what calls what, where the seams are, and which modules
                  actually matter.
                </p>
              </div>

              <div className="mt-14">
                <DropZone
                  onFilesSelected={handleFilesSelected}
                  onGitHubUrlSubmit={handleGitHubUrlSubmit}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}

          {view === 'neural' && (
            <div className="h-[680px] rounded-3xl overflow-hidden shadow-paper-lg border border-ink/20 mt-6">
              <NeuralPulse isActive={true} />
            </div>
          )}

          {view === 'result' && analysisData && (
            <div className="pt-4">
              <button
                onClick={resetAnalysis}
                className="mb-5 group inline-flex items-center gap-2 label-mono text-ink-mute hover:text-vermillion transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Map another project
              </button>
              <ArchitectureGraph data={analysisData} />
            </div>
          )}

          {/* === ERROR (independent of view switcher) === */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="mt-6 max-w-4xl mx-auto p-5 bg-vermillion-50 border border-vermillion/30 rounded-2xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 bg-vermillion text-paper-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="label-mono text-vermillion mb-1">Analysis failed</p>
                    <p className="text-ink-soft text-sm leading-relaxed">{error}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <button
                        onClick={resetAnalysis}
                        className="label-mono text-ink hover:text-vermillion transition-colors"
                      >
                        ← Try again
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* === HOW IT WORKS — only on hero view === */}
      {view === 'hero' && (
        <section id="how-it-works" className="relative px-6 lg:px-10 py-20 border-t border-paper-200/70">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="label-mono text-vermillion mb-3">◐ The Workflow</p>
              <h3 className="font-semibold text-3xl text-ink mb-3 tracking-tight">
                Three steps. One blueprint.
              </h3>
              <p className="text-ink-mute max-w-xl mx-auto">
                Drop the source in, watch it get parsed, then walk the resulting map.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  step: '01',
                  title: 'Hand over the code',
                  description:
                    'Drop files in, point at a GitHub repo, or paste a zip. Everything stays in memory.',
                },
                {
                  step: '02',
                  title: 'The AI gets to work',
                  description:
                    'Gemini reads every file, identifies functions and modules, then traces dependencies between them.',
                },
                {
                  step: '03',
                  title: 'Walk the blueprint',
                  description:
                    'A layered map appears — click any node to read its purpose, see its callers and exports.',
                },
              ].map((feature, i) => (
                <motion.div
                  key={feature.step}
                  className="relative paper-card rounded-2xl p-7"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="serif-italic text-3xl text-vermillion">{feature.step}</span>
                    <span className="w-8 h-px bg-ink/20" />
                  </div>
                  <h4 className="font-semibold text-lg text-ink mb-2">{feature.title}</h4>
                  <p className="text-ink-soft leading-relaxed text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === FOOTER === */}
      <footer className="relative px-6 lg:px-10 py-10 border-t border-paper-200/70">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="label-mono text-ink-mute">Built for</span>
            <span className="label-mono px-2 py-0.5 bg-paper-100 border border-paper-200 text-ink-soft rounded">
              Google Challenge 2026
            </span>
          </div>
          <div className="flex items-center gap-5 label-mono text-ink-faint">
            <a href="#" className="hover:text-ink-soft transition-colors">Privacy</a>
            <a href="#" className="hover:text-ink-soft transition-colors">Terms</a>
            <span className="flex items-center gap-1.5">
              Powered by <span className="text-vermillion">Gemini</span>
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
}
