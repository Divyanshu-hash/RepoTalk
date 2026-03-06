import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRepo } from '../context/RepoContext';

export default function RootLayout({ children }) {
  const { theme } = useTheme();
  const { loading, loadingMessage, error, setError } = useRepo();

  return (
    <div className={`app-container ${theme === 'light' ? 'light-theme' : ''}`}>
      <div className="app-bg"></div>
      
      {/* Visual Depth Blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

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

      {children}
    </div>
  );
}
