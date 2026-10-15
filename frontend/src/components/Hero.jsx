import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRepo } from '../context/RepoContext'

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
  const { repoHistory, repoHistoryLoading } = useRepo()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    await onLoadRepo(url.trim())
    setLoading(false)
  }

  const handleLoadRecent = async (repoUrl) => {
    setUrl(repoUrl)
    setLoading(true)
    await onLoadRepo(repoUrl)
    setLoading(false)
  }

  return (
    <section className="hero">
      {/* Center: title + search */}
      <div className="hero-content">
        <h1 className="hero-title">RepoTalk</h1>
        <p className="hero-subtitle">
          Talk to any GitHub repository.<br />
          Instant AI-powered analysis, architecture graphs, and chat.
        </p>

        {user ? (
          <form onSubmit={handleSubmit} className="search-bar-wrapper">
            <span className="search-left-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </span>
            <span className="search-divider" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter a GitHub repository URL..."
              disabled={loading}
              className="search-input"
            />
            <button type="submit" className="search-submit-btn" disabled={loading || !url.trim()}>
              {loading ? <div className="spinner-mini" /> : <>Analyze Repo →</>}
            </button>
          </form>
        ) : (
          <>
            <div style={{ marginTop: '2rem' }}>
              <button onClick={login} className="hero-cta-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
            <div className="popular-repos-row">
              <span className="popular-repos-label">Popular repos:</span>
              {POPULAR_REPOS.map((r) => (
                <button key={r.label} className="popular-repo-chip" onClick={login}>
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recently explored — full-width, outside hero-content */}
      {user && !repoHistoryLoading && repoHistory.length > 0 && (
        <div className="recent-repos-section">
          <p className="recent-repos-label">Recently Explored</p>
          <div className="recent-repos-grid">
            {repoHistory.slice(0, 6).map((repo) => (
              <button
                key={repo.id}
                className="recent-repo-card"
                onClick={() => handleLoadRecent(`https://github.com/${repo.full_name}`)}
                disabled={loading}
              >
                <div className="recent-repo-card-top">
                  <span className="recent-repo-name">
                    {repo.full_name?.split('/')[1] || repo.full_name}
                  </span>
                  {repo.language && (
                    <span className="recent-repo-lang">{repo.language}</span>
                  )}
                </div>
                {repo.description && (
                  <p className="recent-repo-desc">{repo.description}</p>
                )}
                <div className="recent-repo-card-bottom">
                  <span className="recent-repo-owner">{repo.full_name?.split('/')[0]}</span>
                  <span className="recent-repo-stars">⭐ {repo.stars ?? 0}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="hero-glow" />
    </section>
  )
}
