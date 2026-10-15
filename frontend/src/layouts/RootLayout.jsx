import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRepo } from '../context/RepoContext';

export default function RootLayout({ children }) {
  const { theme } = useTheme();
  const { error, setError } = useRepo();

  return (
    <div className={`app-container ${theme === 'light' ? 'light-theme' : ''}`}>
      <div className="app-bg"></div>

      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          ⚠️ {error}
        </div>
      )}

      {children}
    </div>
  );
}
