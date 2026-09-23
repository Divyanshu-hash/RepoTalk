import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { RepoProvider, useRepo } from './context/RepoContext';
import { AuthProvider } from './context/AuthContext';
import RootLayout from './layouts/RootLayout';
import LandingPage from './pages/LandingPage';
import WikiPage from './pages/WikiPage';

function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay">
      <div className="loading-overlay-inner">
        <div className="loading-logo">
          <div></div><div></div><div></div>
        </div>
        <div className="loading-spinner"></div>
        <p className="loading-overlay-text">{message || 'Loading repository...'}</p>
        <p className="loading-overlay-sub">Fetching files, building search index...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { repoLoaded, loading, loadingMessage } = useRepo();

  return (
    <RootLayout>
      {loading && <LoadingOverlay message={loadingMessage} />}
      {!repoLoaded && !loading && <LandingPage />}
      {repoLoaded && !loading && <WikiPage />}
    </RootLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RepoProvider>
          <AppContent />
        </RepoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
