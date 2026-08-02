"use client";

import React from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext.jsx';

export default function LandingPage() {
  const { token, role } = useApp();

  return (
    <div style={{ paddingBottom: '5rem' }}>
      
      {/* Premium Hero Section */}
      <section style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh', 
        textAlign: 'center',
        position: 'relative',
        padding: '2rem 1rem'
      }}>
        {/* Floating Glowing Aura */}
        <div style={{
          position: 'absolute',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(30px)',
          top: '15%',
          zIndex: -1
        }}></div>

        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '0.4rem 1rem',
          borderRadius: '20px',
          fontSize: '0.82rem',
          fontWeight: '600',
          color: 'var(--color-primary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '1.5rem',
          boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)'
        }}>
          🛡️ Secure & Private Personal Health Companion
        </div>

        <h1 style={{ 
          fontSize: '3.6rem', 
          fontWeight: '800',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
          marginBottom: '1rem', 
          maxWidth: '850px',
          background: 'linear-gradient(135deg, #ffffff 40%, #a7f3d0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Intelligent Guard Against Lifestyle Diseases
        </h1>

        <p style={{ 
          fontSize: '1.18rem', 
          color: 'var(--text-secondary)', 
          maxWidth: '700px', 
          margin: '0 auto 2.5rem', 
          lineHeight: '1.6',
          fontFamily: 'var(--font-inter)'
        }}>
          MedGuard integrates advanced clinical calculators, automatic report scanner extraction, and secure AI to evaluate chronic heart, kidney, and diabetic health risks in real time.
        </p>

        <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {token ? (
            <Link 
              href={role === 'clinician' ? '/clinician' : '/profile'} 
              className="btn-primary" 
              style={{ textDecoration: 'none', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '600', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }}
            >
              Go to Workspace &rarr;
            </Link>
          ) : (
            <>
              <Link 
                href="/login" 
                className="btn-primary" 
                style={{ textDecoration: 'none', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '600', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }}
              >
                Get Started Securely
              </Link>
              <Link 
                href="/login" 
                className="btn-secondary" 
                style={{ textDecoration: 'none', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '600' }}
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Stats Spotlight Row */}
      <section className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', maxWidth: '1000px', margin: '0 auto 6rem', gap: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h2 style={{ fontSize: '2.5rem', color: 'var(--color-primary)', fontWeight: '800', marginBottom: '0.2rem' }}>10-Yr</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cardiovascular Risk</p>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h2 style={{ fontSize: '2.5rem', color: 'var(--color-secondary)', fontWeight: '800', marginBottom: '0.2rem' }}>CKD</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kidney Health Stage</p>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#f59e0b', fontWeight: '800', marginBottom: '0.2rem' }}>AHA</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Blood Pressure Level</p>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#ff5252', fontWeight: '800', marginBottom: '0.2rem' }}>50km</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency Coverage</p>
        </div>
      </section>

      {/* Core Platform Capabilities Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', fontFamily: 'Outfit' }}>
            Built-in Clinical Support Capabilities
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            All tools operate securely inside your browser, keeping your personal health records completely private
          </p>
        </div>

        <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* Card 1: Vitals Tracking */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Clinical Risk Trackers</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Submit daily logs to automatically check cardiovascular risk percentages, diabetes stages, and kidney GFR levels using standard clinical formulas.
            </p>
          </div>

          {/* Card 2: AI Dialogues */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>AI Health Companion</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Describe symptoms to our private AI clinical assistant. It checks health indicators and drug allergies, asking follow-up questions to understand your symptoms.
            </p>
          </div>

          {/* Card 3: Lab reports OCR */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Report Metrics Extractor</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Drag and drop lab results (PDF or Image) to pull metrics automatically. Review and confirm the extracted numbers before saving them to your history logs.
            </p>
          </div>

          {/* Card 4: Emergency SOS Dispatch */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚨</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Proximity SOS Dispatcher</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Broadcast your location with a single click. Nearby hospitals are immediately notified to dispatch emergency ambulance assistance to your exact coordinates.
            </p>
          </div>

        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: '900px', margin: '8rem auto 4rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '3rem', fontFamily: 'Outfit' }}>How MedGuard Operates</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', textAlign: 'left' }}>
          
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>1</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '0.3rem' }}>Register and Geolocate Profile</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Set up a patient profile or clinician dispatch desk. We check local coordinates to connect patients to the nearest hospital in case of an emergency.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>2</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '0.3rem' }}>Track Health Baselines</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Log vital metrics or scan laboratory files. The dashboard compiles indicators to show your heart, kidney, and glucose health trends.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>3</div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '0.3rem' }}>Coordinate Doctor Consultations</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Generate a temporary 6-digit passcode on your device to share medical histories securely with your doctor during consultation visits.</p>
            </div>
          </div>

        </div>
      </section>

      {/* Lower CTA */}
      <section style={{ 
        maxWidth: '800px', 
        margin: '6rem auto 2rem', 
        padding: '3rem', 
        borderRadius: '16px', 
        background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(16,185,129,0.15)',
        textAlign: 'center'
      }}>
        <h3 style={{ fontSize: '1.6rem', marginBottom: '0.8rem', fontFamily: 'Outfit' }}>Start Protecting Your Health Profile Today</h3>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1.8rem', maxWidth: '500px', margin: '0 auto 1.8rem' }}>
          Explore our clinical trackers and private AI health companion. Create your secure health profile now.
        </p>
        <Link 
          href="/login" 
          className="btn-primary" 
          style={{ textDecoration: 'none', display: 'inline-block', padding: '0.8rem 1.8rem' }}
        >
          {token ? 'Enter Workspace' : 'Sign Up for Free'}
        </Link>
      </section>

    </div>
  );
}
