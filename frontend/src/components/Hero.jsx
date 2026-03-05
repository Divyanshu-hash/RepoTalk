import { useState } from 'react'

export default function Hero({ onLoadRepo }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    await onLoadRepo(url.trim())
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

        <form onSubmit={handleSubmit} className="search-bar-wrapper">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Find open source repos"
            disabled={loading}
            className="search-input"
          />
          <button type="submit" className="search-icon-btn" disabled={loading || !url.trim()}>
            {loading ? (
              <div className="spinner-mini"></div>
            ) : (
              <svg 
                viewBox="0 0 24 24" 
                width="20" 
                height="20" 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            )}
          </button>
        </form>
      </div>

      <div className="hero-glow"></div>
    </section>
  )
}
