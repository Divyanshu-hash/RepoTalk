import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('repotalk_token') || null);
  const [user, setUser] = useState(null);

  // When token changes, save to localStorage and parse user
  useEffect(() => {
    if (token) {
      localStorage.setItem('repotalk_token', token);
      try {
        // Decode JWT payload (simple base64 decode of middle part)
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(atob(payload));
          setUser(decoded);
        }
      } catch (e) {
        console.error('Invalid token format', e);
        setUser(null);
      }
    } else {
      localStorage.removeItem('repotalk_token');
      setUser(null);
    }
  }, [token]);

  // Handle OAuth callback redirect (token in URL query param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      setToken(urlToken);
      // Clean up URL without refreshing the page
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const login = () => {
    // Redirect to the new backend's Google OAuth endpoint
    window.location.href = 'http://localhost:8000/api/v1/auth/google';
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
