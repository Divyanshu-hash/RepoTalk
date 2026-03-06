import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { RepoProvider, useRepo } from './context/RepoContext';
import RootLayout from './layouts/RootLayout';
import LandingPage from './pages/LandingPage';
import WikiPage from './pages/WikiPage';

function AppContent() {
  const { repoLoaded, loading } = useRepo();

  return (
    <RootLayout>
      {!repoLoaded && !loading && <LandingPage />}
      {repoLoaded && <WikiPage />}
    </RootLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <AppContent />
      </RepoProvider>
    </ThemeProvider>
  );
}
