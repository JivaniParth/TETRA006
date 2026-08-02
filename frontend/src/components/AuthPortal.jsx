"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';
import CustomDropdown from './CustomDropdown.jsx';

export default function AuthPortal() {
  const { saveSession } = useApp();
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  
  // Clinician fields
  const [facilityName, setFacilityName] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [geoStatus, setGeoStatus] = useState('Location coordinates not set yet.');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);

    try {
      let result;
      if (activeTab === 'register') {
        const payload = {
          email,
          password,
          role,
          facility_name: role === 'clinician' ? (facilityName || `Hospital (${email})`) : null,
          phone: role === 'clinician' ? (phone || '+1 800-MEDGUARD') : null,
          latitude: role === 'clinician' ? (lat || 12.9238) : null,
          longitude: role === 'clinician' ? (lon || 77.5996) : null
        };
        result = await apiCall('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        result = await apiCall('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      }

      saveSession(result.access_token, result.role, result.user_id, email);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="auth-header">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="medical-shield">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M8 11h8"/>
          <path d="M12 7v8"/>
        </svg>
        <h2>Welcome to MedGuard</h2>
        <p>Your Intelligent Clinical Decision Support Companion</p>
      </div>

      <div className="auth-tabs">
        <button 
          onClick={() => { setActiveTab('login'); setErrorMsg(''); }} 
          className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
        >
          Sign In
        </button>
        <button 
          onClick={() => { setActiveTab('register'); setErrorMsg(''); }} 
          className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="auth-email">Email Address</label>
          <input 
            type="email" 
            id="auth-email" 
            required 
            placeholder="name@medguard.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="auth-password">Password</label>
          <input 
            type="password" 
            id="auth-password" 
            required 
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        {activeTab === 'register' && (
          <>
            <div className="form-group">
              <label htmlFor="auth-role">Account Type</label>
              <CustomDropdown
                options={[
                  { value: 'patient', label: 'Patient' },
                  { value: 'clinician', label: 'Clinician (Healthcare Provider)' }
                ]}
                value={role}
                onChange={setRole}
              />
            </div>

            {role === 'clinician' && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.5rem' }} className="form-group">
                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="auth-facility-name">Hospital / Clinic Name</label>
                  <input 
                    type="text" 
                    id="auth-facility-name" 
                    placeholder="e.g. City General Hospital"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="auth-facility-phone">Dispatch Contact Phone</label>
                  <input 
                    type="text" 
                    id="auth-facility-phone" 
                    placeholder="e.g. +1 800-555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleGeolocate} 
                  className="btn-secondary full-width" 
                  style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}
                >
                  📍 Auto-Detect Facility GPS Location
                </button>
                <div id="auth-geo-status" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'center' }}>
                  {geoStatus}
                </div>
              </div>
            )}
          </>
        )}

        <button type="submit" disabled={isLoading} className="btn-primary" style={{ marginTop: '0.5rem' }}>
          {isLoading ? 'Processing...' : activeTab === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      {errorMsg && (
        <div className="alert alert-danger" style={{ marginTop: '1.2rem', width: '100%', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}
    </section>
  );
}
