import { useEffect, useRef, useCallback, useState } from 'react'
import mermaid from 'mermaid'
import { useAuth } from '../context/AuthContext'
import { useRepo } from '../context/RepoContext'

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#0f1021',
    primaryColor: '#3b3d6e',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#5c7cfa',
    secondaryColor: '#1e1e35',
    secondaryTextColor: '#94a3b8',
    secondaryBorderColor: '#4a4a6a',
    tertiaryColor: '#15152a',
    lineColor: '#5c7cfa',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    nodeBorder: '#5c7cfa',
    clusterBkg: 'rgba(92, 124, 250, 0.08)',
    clusterBorder: 'rgba(92, 124, 250, 0.3)',
    titleColor: '#e2e8f0',
    edgeLabelBackground: '#1a1a2e',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 16,
    nodeSpacing: 50,
    rankSpacing: 60,
    useMaxWidth: true,
  },
  securityLevel: 'loose',
})

const PROGRESS_STEPS = [
  { key: 'started', label: 'Starting generation…', icon: '🚀' },
  { key: 'explanation', label: 'Analyzing repository architecture…', icon: '🔍' },
  { key: 'graph', label: 'Planning architecture graph…', icon: '🧩' },
  { key: 'diagram_compiling', label: 'Compiling Mermaid diagram…', icon: '⚙️' },
  { key: 'complete', label: 'Diagram ready!', icon: '✅' },
]

function getStepIndex(status) {
  if (!status) return -1
  if (status.includes('explanation')) return 1
  if (status.includes('graph')) return 2
  if (status.includes('diagram')) return 3
  if (status === 'complete') return 4
  if (status === 'started') return 0
  return -1
}

export default function RepoGraph({ apiBase }) {
  const { token } = useAuth()
  const {
    metadata,
    diagramData, setDiagramData,
    diagramLoading, setDiagramLoading,
    diagramError, setDiagramError,
    diagramProgress, setDiagramProgress,
  } = useRepo()

  const diagramRef = useRef(null)
  const abortRef = useRef(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [zoom, setZoom] = useState(1)
  const renderIdRef = useRef(0)

  // Extract owner/repo from metadata
  const getOwnerRepo = useCallback(() => {
    if (!metadata?.full_name) return null
    const parts = metadata.full_name.split('/')
    if (parts.length < 2) return null
    return { username: parts[0], repo: parts[1] }
  }, [metadata])

  // Render Mermaid diagram into the container
  const renderMermaid = useCallback(async (diagramCode) => {
    if (!diagramRef.current || !diagramCode) return

    try {
      renderIdRef.current += 1
      const id = `mermaid-diagram-${renderIdRef.current}`
      const { svg } = await mermaid.render(id, diagramCode)
      if (diagramRef.current) {
        diagramRef.current.innerHTML = svg

        // Make SVG responsive
        const svgEl = diagramRef.current.querySelector('svg')
        if (svgEl) {
          svgEl.style.maxWidth = '100%'
          svgEl.style.height = 'auto'
          svgEl.removeAttribute('height')
        }
      }
    } catch (err) {
      console.error('Mermaid render error:', err)
      if (diagramRef.current) {
        diagramRef.current.innerHTML = `<pre class="mermaid-error-code">${diagramCode}</pre>`
      }
    }
  }, [])

  // Re-render when diagramData changes or component mounts with cached data
  useEffect(() => {
    if (diagramData?.diagram) {
      renderMermaid(diagramData.diagram)
    }
  }, [diagramData, renderMermaid])

  // Generate diagram via SSE
  const generateDiagram = useCallback(async () => {
    const ownerRepo = getOwnerRepo()
    if (!ownerRepo) {
      setDiagramError('Could not determine repository owner/name.')
      return
    }

    // Abort any in-flight generation
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setDiagramLoading(true)
    setDiagramError(null)
    setDiagramProgress('Connecting…')
    setDiagramData(null)

    try {
      const res = await fetch(`${apiBase}/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          username: ownerRepo.username,
          repo: ownerRepo.repo,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || errData.error || `Server error (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.status === 'error') {
              throw new Error(event.error || 'Diagram generation failed.')
            }

            // Update progress message
            if (event.message) {
              setDiagramProgress(event.message)
            }

            if (event.status === 'complete') {
              setDiagramData({
                diagram: event.diagram,
                explanation: event.explanation,
                graph: event.graph,
              })
              setDiagramProgress('')
              setDiagramLoading(false)
              return
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr
            }
          }
        }
      }

      // If we exit the loop without a 'complete' event
      if (!diagramData) {
        throw new Error('Stream ended without a complete diagram.')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Diagram generation error:', err)
      setDiagramError(err.message || 'Failed to generate diagram.')
      setDiagramLoading(false)
      setDiagramProgress('')
    }
  }, [apiBase, token, getOwnerRepo, setDiagramData, setDiagramLoading, setDiagramError, setDiagramProgress])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25))
  const handleZoomReset = () => setZoom(1)

  const currentStepIndex = getStepIndex(
    diagramLoading ? (diagramProgress || 'started') : diagramData ? 'complete' : ''
  )

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="diagram-container">
      {/* Toolbar */}
      <div className="diagram-toolbar">
        <h3>🏗️ Architecture Diagram</h3>
        <div className="diagram-toolbar-actions">
          {diagramData && (
            <>
              <button
                className="diagram-btn explanation-toggle"
                onClick={() => setShowExplanation(!showExplanation)}
                title="Toggle explanation"
              >
                {showExplanation ? '📖 Hide Explanation' : '📖 Show Explanation'}
              </button>
              <div className="diagram-zoom-controls">
                <button className="diagram-btn zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button className="diagram-btn zoom-btn" onClick={handleZoomIn} title="Zoom in">+</button>
                <button className="diagram-btn zoom-btn" onClick={handleZoomReset} title="Reset zoom">↺</button>
              </div>
            </>
          )}
          <button
            className="diagram-btn generate-btn"
            onClick={generateDiagram}
            disabled={diagramLoading}
          >
            {diagramLoading ? '⏳ Generating…' : diagramData ? '🔄 Regenerate' : '✨ Generate Diagram'}
          </button>
        </div>
      </div>

      {/* Explanation Panel */}
      {showExplanation && diagramData?.explanation && (
        <div className="diagram-explanation">
          <div className="explanation-header">
            <h4>📋 Architecture Explanation</h4>
            <button className="diagram-btn close-btn" onClick={() => setShowExplanation(false)}>✕</button>
          </div>
          <div className="explanation-content">
            {diagramData.explanation}
          </div>
        </div>
      )}

      {/* Progress Steps */}
      {diagramLoading && (
        <div className="diagram-progress">
          <div className="progress-steps">
            {PROGRESS_STEPS.map((step, i) => (
              <div
                key={step.key}
                className={`progress-step ${
                  i < currentStepIndex ? 'completed' :
                  i === currentStepIndex ? 'active' : 'pending'
                }`}
              >
                <span className="step-icon">{step.icon}</span>
                <span className="step-label">{step.label}</span>
                {i === currentStepIndex && <span className="step-spinner" />}
              </div>
            ))}
          </div>
          <div className="progress-message">{diagramProgress}</div>
        </div>
      )}

      {/* Error State */}
      {diagramError && (
        <div className="diagram-error">
          <div className="error-icon">⚠️</div>
          <p className="error-message">{diagramError}</p>
          <button className="diagram-btn generate-btn" onClick={generateDiagram}>
            🔄 Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!diagramData && !diagramLoading && !diagramError && (
        <div className="diagram-empty">
          <div className="empty-icon">🏗️</div>
          <h4>Architecture Diagram</h4>
          <p>Generate an AI-powered architecture diagram that shows the real components, data flows, and structure of this repository.</p>
          <button className="diagram-btn generate-btn primary" onClick={generateDiagram}>
            ✨ Generate Architecture Diagram
          </button>
        </div>
      )}

      {/* Mermaid Diagram */}
      {diagramData?.diagram && (
        <div className="diagram-viewport" style={{ overflow: 'auto' }}>
          <div
            className="diagram-canvas"
            ref={diagramRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          />
        </div>
      )}
    </div>
  )
}
