import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import mermaid from 'mermaid'

// Configure Mermaid.js for dark theme
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif'
})

const MermaidDiagram = ({ chart }) => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (chart && containerRef.current) {
      const renderDiagram = async () => {
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
          const { svg } = await mermaid.render(id, chart)
          containerRef.current.innerHTML = svg
        } catch (error) {
          console.error("Mermaid parsing error:", error)
          containerRef.current.innerHTML = `<div class="error-toast" style="position:static; margin-top:20px;">⚠️ Failed to render diagram. Syntax error in Mermaid code.</div>`
        }
      }
      renderDiagram()
    }
  }, [chart])

  return <div className="mermaid-container" ref={containerRef} style={{ margin: '2rem 0', display: 'flex', justifyContent: 'center' }} />
}

export default function RepoOverview({ metadata, apiBase }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  const generateAnalysis = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/repo-analysis`, { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setAnalysis('⚠️ ' + data.error)
      } else {
        setAnalysis(data.analysis)
      }
    } catch (err) {
      setAnalysis('⚠️ Failed to generate analysis. Please try again.')
    }
    setLoading(false)
  }

  const formatNumber = (num) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num
  }

  const stats = [
    { icon: '⭐', value: formatNumber(metadata.stars), label: 'Stars' },
    { icon: '🍴', value: formatNumber(metadata.forks), label: 'Forks' },
    { icon: '👁️', value: formatNumber(metadata.watchers), label: 'Watchers' },
    { icon: '❗', value: metadata.open_issues, label: 'Issues' },
    { icon: '💻', value: metadata.language || 'N/A', label: 'Language' },
    { icon: '📜', value: metadata.license || 'None', label: 'License' },
  ]

  return (
    <div>
      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Topics */}
      {metadata.topics && metadata.topics.length > 0 && (
        <div className="topics-row">
          {metadata.topics.map((t, i) => (
            <span className="topic-tag" key={i}>{t}</span>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      <div className="analysis-card">
        <div className="analysis-header">
          <h3>🤖 AI-Powered Analysis</h3>
          {!analysis && (
            <button 
              className="generate-btn" 
              onClick={generateAnalysis} 
              disabled={loading}
            >
              {loading ? '⏳ Analyzing...' : '✨ Generate Analysis'}
            </button>
          )}
        </div>

        {loading && (
          <div className="analysis-placeholder">
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Analyzing repository structure, code patterns, and mapping architecture...</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>This may take 15-30 seconds</p>
          </div>
        )}

        {!loading && !analysis && (
          <div className="analysis-placeholder">
            <div className="placeholder-icon">🔍</div>
            <p>Click "Generate Analysis" to get a detailed AI-powered breakdown of this repository — its purpose, architecture diagrams, tech stack, and more.</p>
          </div>
        )}

        {!loading && analysis && (
          <div className="analysis-content">
            <Markdown
              components={{
                code({node, inline, className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '')
                  if (!inline && match && match[1] === 'mermaid') {
                    return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
                  }
                  return <code className={className} {...props}>{children}</code>
                }
              }}
            >
              {analysis}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  )
}
