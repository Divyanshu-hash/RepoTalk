import React, { createContext, useContext, useState } from 'react';

const RepoContext = createContext();

export const API_BASE = 'http://localhost:8000';

export function RepoProvider({ children }) {
  const [repoLoaded, setRepoLoaded] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);

  // Analysis State Lifted from RepoOverview
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const loadRepo = async (url) => {
    setLoading(true);
    setLoadingMessage('Fetching repository files...');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/load-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setMetadata(data.metadata);
      setRepoLoaded(true);
      setActiveTab('overview');
    } catch (err) {
      setError('Failed to connect to backend. Make sure the server is running on port 8000.');
    }

    setLoading(false);
  };

  const generateAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/repo-analysis`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setAnalysis('⚠️ ' + data.error);
      } else {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      setAnalysis('⚠️ Failed to generate analysis. Please try again.');
    }
    setAnalysisLoading(false);
  };

  const goBack = () => {
    setRepoLoaded(false);
    setMetadata(null);
    setActiveTab('overview');
    setAnalysis(null);
  };

  return (
    <RepoContext.Provider value={{
      repoLoaded,
      metadata,
      activeTab,
      setActiveTab,
      loading,
      loadingMessage,
      error,
      setError,
      loadRepo,
      goBack,
      analysis,
      setAnalysis,
      analysisLoading,
      generateAnalysis
    }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  return useContext(RepoContext);
}
