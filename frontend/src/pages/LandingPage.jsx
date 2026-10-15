import React from 'react';
import Hero from '../components/Hero';
import { useTheme } from '../context/ThemeContext';
import { useRepo } from '../context/RepoContext';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { loadRepo } = useRepo();
  const { user, login, logout } = useAuth();

  return (
    <>
      <header className="landing-header">
        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-icon">
            <div></div><div></div><div></div>
          </div>
          RepoTalk
        </div>

        {/* Right controls */}
        <div className="landing-header-right">
          {/* Theme toggle pill */}
          <button className="landing-theme-pill" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {/* Auth */}
          {user ? (
            <div className="landing-user-pill">
              {user.picture ? (
                <img src={user.picture} alt="avatar" className="landing-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="landing-avatar-fallback">
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <button className="landing-logout-btn" onClick={logout}>Log out</button>
            </div>
          ) : (
            <button className="landing-signin-btn" onClick={login}>Sign in</button>
          )}
        </div>
      </header>

      <Hero onLoadRepo={loadRepo} />
    </>
  );
}
