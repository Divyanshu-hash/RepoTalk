import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const RepoContext = createContext();

export const API_BASE = 'http://localhost:8000/api/v1';

export function RepoProvider({ children }) {
  const { token } = useAuth();
  const [repoLoaded, setRepoLoaded] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [diagramData, setDiagramData] = useState(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState(null);
  const [diagramProgress, setDiagramProgress] = useState('');

  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);

  const [repoHistory, setRepoHistory] = useState([]);
  const [repoHistoryLoading, setRepoHistoryLoading] = useState(false);

  // Fetch repo history whenever token changes
  useEffect(() => {
    if (!token) { setRepoHistory([]); return; }
    const fetchHistory = async () => {
      setRepoHistoryLoading(true);
      try {
        const res = await fetch(`${API_BASE}/repo/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRepoHistory(data.repositories || []);
        }
      } catch (_) {}
      setRepoHistoryLoading(false);
    };
    fetchHistory();
  }, [token]);

  const fetchChatHistory = async (authToken) => {
    const t = authToken || token;
    if (!t) return;
    setChatHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/repo/chat-history`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data.messages || []);
      }
    } catch (_) {}
    setChatHistoryLoading(false);
  };

  const loadRepo = async (url) => {
    setLoading(true);
    setLoadingMessage('Fetching repository files...');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/repo/load-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ repo_url: url })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || 'An error occurred while loading the repository.');
        setLoading(false);
        return;
      }

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setMetadata(data.metadata);
      setRepoLoaded(true);
      setActiveTab('overview');

      // Refresh history so new repo appears on next landing
      if (token) {
        try {
          const hr = await fetch(`${API_BASE}/repo/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (hr.ok) {
            const hd = await hr.json();
            setRepoHistory(hd.repositories || []);
          }
        } catch (_) {}
      }

      await fetchChatHistory();
    } catch (_) {
      setError('Failed to connect to backend. Make sure the server is running on port 8000.');
    }

    setLoading(false);
  };

  const generateAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/repo/analysis`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.error) {
        setAnalysis('⚠️ ' + data.error);
      } else {
        setAnalysis(data.analysis);
      }
    } catch (_) {
      setAnalysis('⚠️ Failed to generate analysis. Please try again.');
    }
    setAnalysisLoading(false);
  };

  const goBack = () => {
    setRepoLoaded(false);
    setMetadata(null);
    setActiveTab('overview');
    setAnalysis(null);
    setDiagramData(null);
    setDiagramLoading(false);
    setDiagramError(null);
    setDiagramProgress('');
    setChatHistory([]);
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
      generateAnalysis,
      diagramData,
      setDiagramData,
      diagramLoading,
      setDiagramLoading,
      diagramError,
      setDiagramError,
      diagramProgress,
      setDiagramProgress,
      chatHistory,
      chatHistoryLoading,
      repoHistory,
      repoHistoryLoading,
    }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  return useContext(RepoContext);
}
