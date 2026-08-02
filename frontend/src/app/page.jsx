"use client";

import React from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext.jsx';

export default function LandingPage() {
  const { token, role } = useApp();

  return (
    <div style={{ paddingBottom: '5rem' }}>
      
      {/* Clean & Professional Hero Section */}
      <section style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '3rem',
        alignItems: 'center',
        minHeight: '75vh', 
        padding: '3rem 1rem 3rem',
        maxWidth: '1300px',
        margin: '0 auto'
      }} className="auth-split-grid">
        
        {/* Left Column: Clear Value Proposition */}
        <div style={{ textAlign: 'left' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '0.4rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: '700',
            color: 'var(--color-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '1.2rem'
          }}>
            Personal Health & Emergency Assistant
          </div>

          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: '800',
            lineHeight: '1.18',
            marginBottom: '1.2rem', 
            color: 'var(--text-main)'
          }}>
            Simple Clinical Tracking & AI Support for Your Daily Health
          </h1>

          <p style={{ 
            fontSize: '1.1rem', 
            color: 'var(--text-muted)', 
            marginBottom: '2rem', 
            lineHeight: '1.6',
            maxWidth: '580px'
          }}>
            MedGuard helps you monitor your blood pressure, sugar levels, and heart risks in plain language. Easily upload lab reports, talk to our AI assistant, and send emergency alerts when you need assistance.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {token ? (
              <Link 
                href={role === 'clinician' ? '/clinician' : '/dashboard'} 
                className="btn-primary" 
                style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '700', textDecoration: 'none' }}
              >
                Go to Health Workspace &rarr;
              </Link>
            ) : (
              <>
                <Link 
                  href="/signup" 
                  className="btn-primary" 
                  style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '700', textDecoration: 'none' }}
                >
                  Create Free Profile
                </Link>
                <Link 
                  href="/login" 
                  className="btn-secondary" 
                  style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '600', textDecoration: 'none' }}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Key Trust Points */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2.2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--card-border)' }}>
            <div>
              <div style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.95rem' }}>✓ 100% Private</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Stored securely in your session</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-secondary)', fontWeight: '700', fontSize: '0.95rem' }}>✓ AI Voice & Text</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Speak or type symptoms easily</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-warning)', fontWeight: '700', fontSize: '0.95rem' }}>✓ 1-Click SOS</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nearest ambulance dispatch</div>
            </div>
          </div>

        </div>

        {/* Right Column: Clear Interface Preview */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '0.6rem', borderRadius: '16px', border: '1px solid #374151', background: '#111827' }}>
            <img 
              src="/hero_dashboard.svg" 
              alt="MedGuard Dashboard Preview"
              style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }}
            />
          </div>
        </div>

      </section>

      {/* Health Indicators Summary Strip */}
      <section style={{ maxWidth: '1200px', margin: '0 auto 5rem', padding: '0 1rem' }}>
        <div className="card" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem', 
          padding: '2rem',
          background: '#111827',
          border: '1px solid #1f2937'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'Outfit' }}>Heart Health</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>10-Year Cardiovascular ASCVD Risk Score</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--color-secondary)', fontFamily: 'Outfit' }}>Kidney Function</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Kidney Filtration Stage & Creatinine Tracking</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b', fontFamily: 'Outfit' }}>Blood Pressure</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Standard Systolic & Diastolic Monitoring</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444', fontFamily: 'Outfit' }}>Emergency SOS</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Automatic GPS Location & Hospital Dispatch</p>
          </div>
        </div>
      </section>

      {/* 4 Main Core Features (Plain Language) */}
      <section style={{ maxWidth: '1200px', margin: '0 auto 5rem', padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'Outfit' }}>
            Everything You Need to Manage Your Health
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Designed for patients and families with simple controls and instant medical feedback
          </p>
        </div>

        <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          
          <div className="card" style={{ padding: '1.8rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>📊</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Vital Signs Logging</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Enter your blood pressure readings, glucose levels, or heart rate to view clear trend graphs and risk indicators.
            </p>
          </div>

          <div className="card" style={{ padding: '1.8rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>💬</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Voice & Text AI Assistant</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Ask questions about symptoms or medications. Use the built-in mic button to talk directly and listen to audio answers.
            </p>
          </div>

          <div className="card" style={{ padding: '1.8rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>📄</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Lab Report Scanner</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Upload lab test PDF files or pictures. MedGuard automatically extracts vital lab values so you do not have to type manually.
            </p>
          </div>

          <div className="card" style={{ padding: '1.8rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>🚑</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Emergency Ambulance Call</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              One tap sends your coordinates to nearby hospitals so emergency personnel can dispatch assistance right away.
            </p>
          </div>

        </div>
      </section>

      {/* How it Works (Intuitive 3 Step Guide) */}
      <section style={{ maxWidth: '900px', margin: '0 auto 5rem', padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'Outfit' }}>How to Use MedGuard in 3 Easy Steps</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.4rem 1.8rem' }}>
            <div style={{ 
              background: 'var(--color-primary)', 
              color: '#030712', 
              width: '38px', 
              height: '38px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '800', 
              fontSize: '1.1rem',
              flexShrink: 0 
            }}>1</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.2rem' }}>Create Your Free Account</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Sign up in seconds to set up your profile and baseline details.</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.4rem 1.8rem' }}>
            <div style={{ 
              background: 'var(--color-secondary)', 
              color: '#030712', 
              width: '38px', 
              height: '38px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '800', 
              fontSize: '1.1rem',
              flexShrink: 0 
            }}>2</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.2rem' }}>Log Your Metrics or Talk to AI</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Type or speak your vitals or upload your latest lab reports for instant analysis.</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.4rem 1.8rem' }}>
            <div style={{ 
              background: '#f59e0b', 
              color: '#030712', 
              width: '38px', 
              height: '38px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '800', 
              fontSize: '1.1rem',
              flexShrink: 0 
            }}>3</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.2rem' }}>Share Code with Doctor During Consultation</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Generate a 6-digit access passcode on your phone to permit your doctor to update your records securely.</p>
            </div>
          </div>

        </div>
      </section>

      {/* Simple CTA */}
      <section style={{ maxWidth: '850px', margin: '0 auto', padding: '0 1rem', textAlign: 'center' }}>
        <div className="card" style={{ padding: '3rem 2rem', background: '#111827', border: '1px solid #1f2937' }}>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '0.6rem', fontFamily: 'Outfit', fontWeight: '800' }}>Ready to Start Tracking Your Health?</h3>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.8rem', maxWidth: '480px', margin: '0 auto 1.8rem' }}>
            Join MedGuard today for private, intelligent clinical tracking and voice-assisted health support.
          </p>
          <Link 
            href={token ? (role === 'clinician' ? '/clinician' : '/dashboard') : '/signup'} 
            className="btn-primary" 
            style={{ textDecoration: 'none', display: 'inline-block', padding: '0.85rem 2.2rem', fontSize: '1rem', fontWeight: '700' }}
          >
            {token ? 'Go to Workspace &rarr;' : 'Create Free Profile &rarr;'}
          </Link>
        </div>
      </section>

    </div>
  );
}
