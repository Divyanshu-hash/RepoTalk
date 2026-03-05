import { useState } from 'react'
import Hero from './components/Hero'
import RepoOverview from './components/RepoOverview'
import RepoGraph from './components/RepoGraph'
import ChatPanel from './components/ChatPanel'

const API_BASE = 'http://localhost:8000'

export default function App() {
  const [repoLoaded, setRepoLoaded] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState('dark')

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const loadRepo = async (url) => {
    setLoading(true)
    setLoadingMessage('Fetching repository files...')
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/load-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url })
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setMetadata(data.metadata)
      setRepoLoaded(true)
      setActiveTab('overview')
    } catch (err) {
      setError('Failed to connect to backend. Make sure the server is running on port 8000.')
    }

    setLoading(false)
  }

  const goBack = () => {
    setRepoLoaded(false)
    setMetadata(null)
    setActiveTab('overview')
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'graph', label: '🕸️ Graph', icon: '🕸️' },
    { id: 'chat', label: '💬 Chat', icon: '💬' },
  ]

  return (
    <div className={`app-container ${theme === 'light' ? 'light-theme' : ''}`}>
      <div className="app-bg"></div>

      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <h3>Analyzing Repository</h3>
          <p>{loadingMessage}</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
            This may take a minute for large repositories...
          </p>
        </div>
      )}

      {/* Hero (when no repo loaded) */}
      {!repoLoaded && !loading && (
        <>
          <header className="landing-header">
            <div className="landing-logo">
              <div className="landing-logo-icon">
                <div></div><div></div><div></div>
              </div>
              RepoTalk
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              )}
            </button>
          </header>
          <Hero onLoadRepo={loadRepo} />
        </>
      )}

      {/* Main Content (when repo is loaded) */}
      {repoLoaded && metadata && (
        <div className="wiki-layout">
          {/* Persistent Sidebar Navigation */}
          <aside className="wiki-sidebar">
            <div className="sidebar-header">
              {metadata.owner_avatar && (
                <img src={metadata.owner_avatar} alt="owner" className="avatar" />
              )}
              <div>
                <div className="repo-name" title={metadata.name}>{metadata.name}</div>
                <div className="repo-owner">{metadata.full_name.split('/')[0]}</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <div className="nav-group-title">Repository Insight</div>
              <button 
                className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} 
                onClick={() => setActiveTab('overview')}
              >
                <span className="icon">📖</span> Documentation
              </button>
              <button 
                className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`} 
                onClick={() => setActiveTab('graph')}
              >
                <span className="icon">🕸️</span> Architecture
              </button>

              <div className="nav-group-title" style={{ marginTop: '1.5rem' }}>AI Tools</div>
              <button 
                className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} 
                onClick={() => setActiveTab('chat')}
              >
                <span className="icon">💬</span> Assistant
              </button>
            </nav>

            <div className="sidebar-footer">
              <button className="theme-toggle-btn-small" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
              <button className="back-btn" onClick={goBack}>
                ← Exit
              </button>
            </div>
          </aside>

          {/* Main Reading Area */}
          <main className="wiki-main">
            <div className="wiki-topbar">
              <div className="breadcrumbs">
                {metadata.full_name} 
                <span className="separator">/</span> 
                <span className="current-page">
                  {activeTab === 'overview' ? 'Documentation' : 
                   activeTab === 'graph' ? 'Architecture' : 'Assistant'}
                </span>
              </div>
              <a href={metadata.html_url} target="_blank" rel="noreferrer" className="github-link">
                View on GitHub ↗
              </a>
            </div>

            <div className={`wiki-content ${activeTab}`}>
              {activeTab === 'overview' && (
                <RepoOverview metadata={metadata} apiBase={API_BASE} />
              )}

              {activeTab === 'graph' && (
                <RepoGraph apiBase={API_BASE} />
              )}

              {activeTab === 'chat' && (
                <ChatPanel apiBase={API_BASE} />
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
