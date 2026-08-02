"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext.jsx';
import { apiCall } from '../../services/api';
import CustomDropdown from '../../components/CustomDropdown.jsx';

export default function SignupPage() {
  const { token, role, isMounted, saveSession, showToast } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState('patient');
  
  // Clinician fields
  const [facilityName, setFacilityName] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [geoStatus, setGeoStatus] = useState('Location coordinates not set yet.');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isMounted && token) {
      if (role === 'clinician') {
        router.push('/clinician');
      } else {
        router.push('/dashboard');
      }
    }
  }, [token, role, isMounted]);

  const handleGeolocate = () => {
    setGeoStatus('Locating sensor coordinates...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLon(pos.coords.longitude);
          setGeoStatus(`📍 Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)} (Locked)`);
        },
        (err) => {
          console.warn("Geolocation blocked/failed", err);
          const defaultLat = 12.9238;
          const defaultLon = 77.5996;
          setLat(defaultLat);
          setLon(defaultLon);
          setGeoStatus(`📍 Lat: ${defaultLat} (Default), Lon: ${defaultLon} (Default)`);
        }
      );
    } else {
      setGeoStatus('Geolocation not supported by this browser.');
    }
  };

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
    if (userRole === 'clinician' && (!facilityName || !facilityName.trim())) {
      showToast('Please fill out the Facility Name for your clinician account', 'danger');
      return;
    }
    if (userRole === 'clinician' && (!phone || !phone.trim())) {
      showToast('Please fill out the Contact Phone for your clinician account', 'danger');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        email,
        password,
        role: userRole,
        facility_name: userRole === 'clinician' ? (facilityName || `Hospital (${email})`) : null,
        phone: userRole === 'clinician' ? (phone || '+1 800-MEDGUARD') : null,
        latitude: userRole === 'clinician' ? (lat || 12.9238) : null,
        longitude: userRole === 'clinician' ? (lon || 77.5996) : null
      };

      const result = await apiCall('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      saveSession(result.access_token, result.role, result.user_id, email);
    } catch (err) {
      setErrorMsg(err.message || 'Registration request failed.');
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
      
      {/* LEFT COLUMN: Themed Written Content & Visual Graphic */}
      {/* LEFT COLUMN: Written Information */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }} className="auth-graphic-side">
        <div className="card" style={{ padding: '2.2rem' }}>
          <h3 style={{ fontSize: '1.4rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--color-primary)' }}>
            🛡️ Join MedGuard Health Network
          </h3>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
            Create your account to log vital metrics, track chronic risk trends over time, and consult our secure AI health assistant.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-secondary)' }}>✦</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Interactive graphs to track blood pressure, sugar, and heart rate</span>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-secondary)' }}>✦</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Simple PDF/Image uploader to scan lab reports automatically</span>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'start' }}>
              <span style={{ color: 'var(--color-secondary)' }}>✦</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Location search to locate nearby hospitals in an emergency</span>
            </div>
          </div>
        </div>

        {/* Dynamic Security Graphic Panel */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem 2rem', overflow: 'hidden' }}>
          <img 
            src="/security_shield.svg" 
            alt="MedGuard Security Shield" 
            style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }}
          />
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', fontWeight: '700' }}>Verified Healthcare Privacy</strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Temporary doctor passcode verification ensuring absolute data ownership</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Sign Up Form */}
      <div className="card" style={{ padding: '2.5rem 2rem', position: 'relative' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)', filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.45))', marginBottom: '0.8rem' }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Register Profile</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Create a patient baseline or clinical dispatch account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="register-email">Email Address</label>
            <input 
              type="email" 
              id="register-email" 
              required 
              placeholder="name@medguard.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <input 
              type="password" 
              id="register-password" 
              required 
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-role">Account Type</label>
            <CustomDropdown
              options={[
                { value: 'patient', label: 'Patient' },
                { value: 'clinician', label: 'Clinician (Healthcare Provider)' }
              ]}
              value={userRole}
              onChange={setUserRole}
            />
          </div>

          {userRole === 'clinician' && (
            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="form-group">
                <label htmlFor="register-facility-name">Hospital / Clinic Name</label>
                <input 
                  type="text" 
                  id="register-facility-name" 
                  placeholder="e.g. City General Hospital"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="register-phone">Dispatch Contact Phone</label>
                <input 
                  type="text" 
                  id="register-phone" 
                  placeholder="e.g. +1 800-555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ gap: '0.6rem' }}>
                <label>Facility Sensor Coordinates</label>
                <button type="button" onClick={handleGeolocate} className="btn-secondary" style={{ fontSize: '0.85rem', width: '100%', height: '40px' }}>
                  📡 Calibrate GPS Location
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-secondary)', display: 'block', textAlign: 'center', marginTop: '0.2rem' }}>
                  {geoStatus}
                </span>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary full-width" style={{ height: '48px', fontWeight: '700', marginTop: '0.8rem' }} disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Sign Up Securely'}
          </button>
        </form>

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginTop: '1.2rem', textAlign: 'center', fontSize: '0.88rem' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Already a MedGuardian?{' '}
            <Link href="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Log In
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
