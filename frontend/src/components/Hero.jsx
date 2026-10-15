import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const POPULAR_REPOS = [
  { label: 'angular', url: 'https://github.com/angular/angular' },
  { label: 'react', url: 'https://github.com/facebook/react' },
  { label: 'vscode', url: 'https://github.com/microsoft/vscode' },
  { label: 'linux', url: 'https://github.com/torvalds/linux' },
]

export default function Hero({ onLoadRepo }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    await onLoadRepo(url.trim())
    setLoading(false)
  }

  const handlePopular = async (repoUrl) => {
    setUrl(repoUrl)
    setLoading(true)
    await onLoadRepo(repoUrl)
    setLoading(false)
  }

  return (
    <section className="hero">
      <div className="hero-content">
        <h1 className="hero-title">RepoTalk</h1>
        <p className="hero-subtitle">
          Talk to any GitHub repository.<br />
          Instant AI-powered analysis, architecture graphs, and chat.
        </p>

        {user ? (
          <>
            <form onSubmit={handleSubmit} className="search-bar-wrapper">
              {/* Search icon on the left */}
              <span className="search-left-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Find open source repos..."
                disabled={loading}
                className="search-input"
              />

              {/* Inline Search button */}
              <button type="submit" className="search-submit-btn" disabled={loading || !url.trim()}>
                {loading ? <div className="spinner-mini" /> : 'Search'}
              </button>
            </form>

            {/* Popular repos chips */}
            <div className="popular-repos-row">
              <span className="popular-repos-label">Popular repos:</span>
              {POPULAR_REPOS.map((r) => (
                <button
                  key={r.label}
                  className="popular-repo-chip"
                  onClick={() => handlePopular(r.url)}
                  disabled={loading}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ marginTop: '2rem' }}>
            <button onClick={login} className="hero-cta-btn">
              Sign in with Google to start
            </button>
          </div>
        )}
      </div>

      <div className="hero-glow" />
    </section>
  )
}
