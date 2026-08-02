"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext.jsx';
import { apiCall } from '../../services/api';

export default function LoginPage() {
  const { token, role, isMounted, saveSession, showToast } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auth Redirect Guard
  useEffect(() => {
    if (isMounted && token) {
      if (role === 'clinician') {
        router.push('/clinician');
      } else {
        router.push('/dashboard');
      }
    }
  }, [token, role, isMounted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !email.trim()) {
      showToast('Please fill out your Email Address', 'danger');
      return;
    }
    if (!password || !password.trim()) {
      showToast('Please fill out your Password', 'danger');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiCall('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      saveSession(result.access_token, result.role, result.user_id, email);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '3rem', 
      alignItems: 'center', 
      minHeight: '80vh', 
      padding: '2rem 1rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }} className="auth-split-grid">
      
      {/* LEFT COLUMN: Login Form */}
      <div className="card" style={{ padding: '2.5rem 2rem', position: 'relative' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.45))', marginBottom: '0.8rem' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M8 11h8"/>
            <path d="M12 7v8"/>
          </svg>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Sign In to MedGuard</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Access your clinical decision support workspaces</p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input 
              type="email" 
              id="login-email" 
              required 
              placeholder="name@medguard.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input 
              type="password" 
              id="login-password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn-primary full-width" style={{ height: '48px', fontWeight: '700', marginTop: '0.8rem' }} disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In Securely'}
          </button>
        </form>

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginTop: '1.2rem', textAlign: 'center', fontSize: '0.88rem' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            New to MedGuard?{' '}
            <Link href="/signup" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Written Content & Information */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }} className="auth-graphic-side">
        <div className="card" style={{ padding: '2.2rem' }}>
          <h3 style={{ fontSize: '1.4rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--color-primary)' }}>
            🛡️ Secure & Private Health Tracking
          </h3>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
            Only you control your medical data. Logs are cached locally in your browser, and sharing clinical information with doctors is protected under your strict temporary passcode control.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-primary)' }}>✔</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Instant AI clinical symptom suggestions & guidance</span>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-primary)' }}>✔</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Automated cardiovascular and diabetes risk warnings</span>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-primary)' }}>✔</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Drug interaction warnings to protect your medication intake</span>
            </div>
          </div>
        </div>

        {/* CSS Heartbeat Graphic Panel */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem 2rem', overflow: 'hidden' }}>
          <img 
            src="/security_shield.svg" 
            alt="MedGuard Security Shield" 
            style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }}
          />
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', fontWeight: '700' }}>Instant Emergency Protection</strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>One-click SOS coordinates broadcast and nearest ambulance dispatching</span>
          </div>
        </div>
      </div>

    </div>
  );
}
