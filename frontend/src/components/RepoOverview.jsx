import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import mermaid from 'mermaid'
import { useRepo } from '../context/RepoContext'

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
          // Sanitize common AI-generated Mermaid syntax errors
          const sanitizedChart = chart
            // Remove parentheses inside square-bracket node labels: [Label (Tech)] → [Label Tech]
            .replace(/\[([^\]]*?)\(([^)]+)\)([^\]]*)\]/g, '[$1$2$3]')
            // Remove parentheses inside curly-brace labels: {Label (x)} → {Label x}
            .replace(/\{([^}]*?)\(([^)]+)\)([^}]*)\}/g, '{$1$2$3}')
            // Fix |label|> edge typo
            .replace(/\|([^|]+)\|>\s*/g, '|$1|')
            // Fix stray spaces after labeled edges
            .replace(/\|([^|]+)\|\s+/g, '|$1|')
            // Replace smart/curly quotes with straight quotes
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .trim();

          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
          const { svg } = await mermaid.render(id, sanitizedChart)
          if (containerRef.current) containerRef.current.innerHTML = svg
        } catch (error) {
          console.error("Mermaid parsing error:", error)
          if (containerRef.current)
            containerRef.current.innerHTML = `<div class="error-toast" style="position:static; margin-top:20px;">⚠️ Failed to render diagram. Syntax error in Mermaid code.</div>`
        }
      }
      renderDiagram()
    }
  }, [chart])

  return <div className="mermaid-container" ref={containerRef} style={{ margin: '2rem 0', display: 'flex', justifyContent: 'center' }} />
}

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export default function RepoOverview() {
  const { metadata, analysis, analysisLoading, generateAnalysis } = useRepo()

  const formatNumber = (num) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num
  }

  const stats = [
    { icon: '⭐', value: formatNumber(metadata.stars), label: 'Stars', color: '#ffd700' },
    { icon: '🍴', value: formatNumber(metadata.forks), label: 'Forks', color: '#74b9ff' },
    { icon: '👁️', value: formatNumber(metadata.watchers), label: 'Watchers', color: '#a29bfe' },
    { icon: '❗', value: metadata.open_issues, label: 'Issues', color: '#ff7675' },
  ]

  return (
    <div className="repo-overview-container">
      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i} style={{ '--accent': s.color, animationDelay: `${i * 0.05}s` }}>
            <div className="stat-content">
              <div className="stat-icon-bg">
                <span className="stat-icon">{s.icon}</span>
              </div>
              <div className="stat-info">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Topics */}
      {metadata.topics && metadata.topics.length > 0 && (
        <div className="topics-row-wiki">
          <div className="topics-label">TAGS</div>
          <div className="topics-list">
            {metadata.topics.map((t, i) => (
              <span className="topic-tag-wiki" key={i}>{t}</span>
            ))}
          </div>
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
              disabled={analysisLoading}
            >
              {analysisLoading ? '⏳ Analyzing...' : '✨ Generate Analysis'}
            </button>
          )}
        </div>

        {analysisLoading && (
          <div className="analysis-placeholder">
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Analyzing repository structure, code patterns, and mapping architecture...</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>This may take 15-30 seconds</p>
          </div>
        )}

        {!analysisLoading && !analysis && (
          <div className="analysis-placeholder">
            <div className="placeholder-icon">🔍</div>
            <p>Click "Generate Analysis" to get a detailed AI-powered breakdown of this repository — its purpose, architecture diagrams, tech stack, and more.</p>
          </div>
        )}

        {!analysisLoading && analysis && (
          <div className="analysis-content">
            <Markdown
              components={{
                h1({ node, children, ...props }) {
                  const id = slugify(children);
                  return <h1 id={id} {...props}>{children}</h1>;
                },
                h2({ node, children, ...props }) {
                  const id = slugify(children);
                  return <h2 id={id} {...props}>{children}</h2>;
                },
                h3({ node, children, ...props }) {
                  const id = slugify(children);
                  return <h3 id={id} {...props}>{children}</h3>;
                },
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
