import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { useRepo } from '../context/RepoContext'

// Configure Mermaid.js for dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
  suppressErrors: true,
})

const MermaidDiagram = ({ chart }) => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (chart && containerRef.current) {
      const renderDiagram = async () => {
        try {
          const sanitizedChart = chart
            // Remove parentheses inside square-bracket node labels: [Label (Tech)] → [Label - Tech]
            .replace(/\[([^\]]*?)\(([^)]+)\)([^\]]*)\]/g, '[$1$2$3]')
            // Remove parentheses inside curly-brace labels
            .replace(/\{([^}]*?)\(([^)]+)\)([^}]*)\}/g, '{$1$2$3}')
            // Fix |label|> edge typo
            .replace(/\|([^|]+)\|>\s*/g, '|$1|')
            // Fix stray spaces after labeled edges
            .replace(/\|([^|]+)\|\s+/g, '|$1|')
            // Replace smart/curly quotes with straight quotes
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            // Remove any HTML tags that sneak in
            .replace(/<[^>]+>/g, '')
            // Fix common: node labels with colons (Mermaid treats colon as separator)
            .replace(/\["([^"]*):([^"]*)"\]/g, '["$1 $2"]')
            // Remove trailing commas before closing bracket/brace
            .replace(/,(\s*[}\]])/g, '$1')
            .trim()

          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

          // Suppress Mermaid's own error UI by using suppressErrors option
          const { svg } = await mermaid.render(id, sanitizedChart)
          if (containerRef.current) containerRef.current.innerHTML = svg
        } catch (error) {
          console.warn('Mermaid render failed:', error?.message || error)
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div style="
                padding: 1rem 1.25rem;
                background: rgba(255,107,107,0.07);
                border: 1px solid rgba(255,107,107,0.2);
                border-radius: 10px;
                color: #ff6b6b;
                font-size: 0.82rem;
                font-family: inherit;
                margin: 1rem 0;
              ">
                ⚠️ Could not render diagram — the AI generated invalid Mermaid syntax. Try regenerating the analysis.
              </div>`
          }
        }
      }
      renderDiagram()
    }
  }, [chart])

  return <div className="mermaid-container" ref={containerRef} style={{ margin: '1.5rem 0' }} />
}

const slugify = (text) => {
  const str = Array.isArray(text)
    ? text.map(t => (typeof t === 'string' ? t : '')).join('')
    : String(text ?? '');
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/^\d+\.\s*/, '')
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
              remarkPlugins={[remarkGfm]}
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
                table({ children }) {
                  return (
                    <div className="analysis-table-wrapper">
                      <table className="analysis-table">{children}</table>
                    </div>
                  );
                },
                th({ children }) {
                  return <th className="analysis-th">{children}</th>;
                },
                td({ children }) {
                  return <td className="analysis-td">{children}</td>;
                },
                code({node, className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '')
                  const isBlock = node?.position?.start?.line !== node?.position?.end?.line || match
                  if (isBlock && match && match[1] === 'mermaid') {
                    return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
                  }
                  return <code className={className} {...props}>{children}</code>
                },
                li({ children }) {
                  return <li className="analysis-li">{children}</li>;
                },
                ul({ children }) {
                  return <ul className="analysis-ul">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="analysis-ol">{children}</ol>;
                },
                p({ children }) {
                  return <p className="analysis-p">{children}</p>;
                },
                strong({ children }) {
                  return <strong className="analysis-strong">{children}</strong>;
                },
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
