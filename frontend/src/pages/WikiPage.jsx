import React, { useState } from 'react';
import RepoOverview from '../components/RepoOverview';
import RepoGraph from '../components/RepoGraph';
import ChatPanel from '../components/ChatPanel';
import { useTheme } from '../context/ThemeContext';
import { useRepo, API_BASE } from '../context/RepoContext';

export default function WikiPage() {
  const { theme, toggleTheme } = useTheme();
  const { metadata, activeTab, setActiveTab, goBack, analysis } = useRepo();
  const [activeId, setActiveId] = useState(null);

  // Extract headings from markdown analysis
  const headings = React.useMemo(() => {
    if (!analysis) return [];
    const lines = analysis.split('\n');
    const extracted = [];
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/\*+/g, '').trim();
        const id = text
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]+/g, '')
          .replace(/--+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
        extracted.push({ id, text, level });
      }
    }
    return extracted;
  }, [analysis]);

  if (!metadata) return null;

  const handleTocClick = (id) => {
    setActiveId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="wiki-layout">

      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="wiki-sidebar">

        {/* Repo Logo Block */}
        <div className="sidebar-repo-block">
          {metadata.owner_avatar && (
            <img src={metadata.owner_avatar} alt="owner" className="sidebar-avatar" />
          )}
          <div className="sidebar-repo-name" title={metadata.name}>{metadata.name}</div>
          <div className="sidebar-repo-owner">by {metadata.full_name.split('/')[0]}</div>
        </div>

        {/* View Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="tab-icon">📄</span> Documentation
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <span className="tab-icon">🕸️</span> Architecture
          </button>
        </div>

        {/* Dynamic TOC */}
        {activeTab === 'overview' && (
          <div className="sidebar-toc">
            <div className="toc-header">On this page</div>
            {headings.length === 0 ? (
              <div className="toc-empty">Generate analysis to see sections</div>
            ) : (
              <ul className="toc-list">
                {headings.map((h, i) => (
                  <li key={i} className={`toc-item level-${h.level}`}>
                    <button
                      onClick={() => handleTocClick(h.id)}
                      className={`toc-link ${activeId === h.id ? 'active' : ''}`}
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Footer Controls */}
        <div className="sidebar-controls">
          <button className="control-btn theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="control-btn exit-btn" onClick={goBack}>
            ← Exit
          </button>
        </div>
      </aside>

      {/* ===== CENTER MAIN ===== */}
      <main className="wiki-main">
        <div className="wiki-topbar">
          <div className="breadcrumbs">
            <span className="breadcrumb-repo">{metadata.full_name}</span>
            <span className="separator">/</span>
            <span className="current-page">
              {activeTab === 'overview' ? 'Documentation' : 'Architecture'}
            </span>
          </div>
          <a href={metadata.html_url} target="_blank" rel="noreferrer" className="github-link">
            View on GitHub ↗
          </a>
        </div>

        <div className="wiki-content">
          <div style={{ display: activeTab === 'overview' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
            <RepoOverview />
          </div>
          <div style={{ display: activeTab === 'graph' ? 'block' : 'none', height: '100%' }}>
            <RepoGraph apiBase={API_BASE} />
          </div>
        </div>
      </main>

      {/* ===== RIGHT CHAT ===== */}
      <aside className="wiki-assistant">
        <ChatPanel apiBase={API_BASE} />
      </aside>
    </div>
  );
}
