"use client";

import React from 'react';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '../styles/globals.css';
import { AppProvider, useApp } from '../context/AppContext.jsx';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

function NavigationHeader() {
  const { token, role, email, logout } = useApp();
  const pathname = usePathname();

  return (
    <header id="main-header">
      <div className="nav-container">
        <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M8 11h8"/>
            <path d="M12 7v8"/>
          </svg>
          <span>MedGuard</span>
        </Link>
        
        <nav>
          <div className="nav-links">
            {token && role === 'patient' && (
              <>
                <Link 
                  href="/profile" 
                  className={`nav-btn ${pathname === '/profile' ? 'active' : ''}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Vitals & Profile
                </Link>
                <Link 
                  href="/chat" 
                  className={`nav-btn ${pathname === '/chat' ? 'active' : ''}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  AI Chat
                </Link>
                <Link 
                  href="/history" 
                  className={`nav-btn ${pathname === '/history' ? 'active' : ''}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  History
                </Link>
                <Link 
                  href="/reports" 
                  className={`nav-btn ${pathname === '/reports' ? 'active' : ''}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Lab Reports
                </Link>
              </>
            )}
            {token && role === 'clinician' && (
              <Link 
                href="/clinician" 
                className={`nav-btn ${pathname === '/clinician' ? 'active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Clinician Dashboard
              </Link>
            )}
          </div>
        </nav>

        <div className="user-profile">
          {token ? (
            <>
              <span id="display-user-email">{email}</span>
              <button onClick={logout} className="logout-btn" title="Log Out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-btn" style={{ border: '1px solid var(--color-primary)' }}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function LayoutContent({ children }) {
  return (
    <div className={`${inter.variable} ${outfit.variable}`} style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      <NavigationHeader />
      {/* Background Glows */}
      <div className="glow glow-1"></div>
      <div className="glow glow-2"></div>
      <main className="container">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>MedGuard — Clinical Decision Support Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <AppProvider>
          <LayoutContent>
            {children}
          </LayoutContent>
        </AppProvider>
      </body>
    </html>
  );
}
