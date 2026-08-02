"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall, API_BASE } from '../services/api';
import VitalsTimeline from './VitalsTimeline.jsx';

export default function PatientDashboard() {
  const {
    userId,
    indicators,
    activeSos,
    setActiveSos,
    handlePatientSosTrigger,
    fetchIndicators,
    fetchTimeline,
    checkActiveSos,
    showToast
  } = useApp();

  // Local OTP states
  const [otpCode, setOtpCode] = useState('');
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [showOtp, setShowOtp] = useState(false);
  const [otpTimerId, setOtpTimerId] = useState(null);

  // Local Hospital states
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [hospitalsError, setHospitalsError] = useState('');

  useEffect(() => {
    if (userId) {
      fetchIndicators();
      fetchTimeline();
      checkActiveSos();
    }
    
    return () => {
      if (otpTimerId) clearInterval(otpTimerId);
    };
  }, [userId]);

  const handleGenerateOtp = async () => {
    try {
      const data = await apiCall('/patient/access-code/generate', { method: 'POST' });
      setShowOtp(true);
      
      const rawCode = data.otp_code || '';
      setOtpCode(rawCode.substring(0, 3) + ' ' + rawCode.substring(3));
      
      let secondsLeft = data.expires_in_seconds || 60;
      setOtpSeconds(secondsLeft);
      
      if (otpTimerId) {
        clearInterval(otpTimerId);
      }
      
      const timer = setInterval(() => {
        secondsLeft--;
        setOtpSeconds(secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(timer);
          setShowOtp(false);
          setOtpTimerId(null);
        }
      }, 1000);
      setOtpTimerId(timer);
    } catch (err) {
      showToast(`Failed to generate Access OTP: ${err.message}`, 'danger');
    }
  };

  const handleFindHospitals = () => {
    setHospitalsLoading(true);
    setHospitalsError('');
    setHospitals([]);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const data = await apiCall(`/patient/hospitals/nearby?latitude=${lat}&longitude=${lon}`);
          setHospitals(data || []);
        } catch (err) {
          setHospitalsError(`Error querying locator: ${err.message}`);
        } finally {
          setHospitalsLoading(false);
        }
      },
      async (err) => {
        console.warn("Geolocation blocked/denied. Using default fallback coordinates.", err);
        const fallbackLat = 12.9250;
        const fallbackLon = 77.6000;
        try {
          const data = await apiCall(`/patient/hospitals/nearby?latitude=${fallbackLat}&longitude=${fallbackLon}`);
          setHospitals(data || []);
        } catch (error) {
          setHospitalsError(`Error querying locator: ${error.message}`);
        } finally {
          setHospitalsLoading(false);
        }
      }
    );
  };

  const getRiskStatusClass = (stage, overrideClass = '') => {
    if (overrideClass) return `risk-${overrideClass}`;
    if (!stage) return 'risk-normal';
    const s = stage.toLowerCase();
    if (s.includes('stage 2') || s.includes('high') || s.includes('severe') || s.includes('danger') || s.includes('crisis')) {
      return 'risk-danger';
    }
    if (s.includes('stage 1') || s.includes('elevated') || s.includes('borderline') || s.includes('pre-') || s.includes('moderate')) {
      return 'risk-elevated';
    }
    return 'risk-normal';
  };

  const handleCancelSos = async () => {
    try {
      await apiCall(`/patient/${userId}/emergency/cancel`, { method: 'POST' });
      setActiveSos(null);
      if (showToast) showToast('Emergency SOS alert cancelled.', 'warning');
    } catch (err) {
      if (showToast) showToast(`Failed to cancel SOS: ${err.message}`, 'danger');
    }
  };

  return (
    <div className="patient-dashboard-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Overview header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Your Health Dashboard</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Real-time indicators, historical vitals trends, and secure emergency dispatch services</p>
        </div>
        <button
          onClick={() => {
            if (!userId) return;
            const token = localStorage.getItem('medguard_token') || '';
            window.open(`${API_BASE}/patient/${userId}/export-pdf?token=${encodeURIComponent(token)}`, '_blank');
          }}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          📄 Export Health Passport (PDF)
        </button>
      </div>

      {/* Calculated Clinical Risks */}
      <div className="card card-risks full-width-card" style={{ margin: 0 }}>
        <div className="card-header">
          <h3>Calculated Health Indicators</h3>
          <p>Determined from your latest vitals submissions and baseline profile variables</p>
        </div>
        
        <div className="risk-indicators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
          
          <div className={`indicator-card ${getRiskStatusClass(indicators?.blood_pressure_stage?.stage)}`} id="ind-bp">
            <div className="ind-icon">❤️</div>
            <h4>Blood Pressure Stage</h4>
            <div className="ind-val">{indicators?.blood_pressure_stage?.stage || 'No Data'}</div>
            <p className="ind-desc">Based on logged blood pressure standards.</p>
          </div>

          <div className={`indicator-card ${getRiskStatusClass(
            indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score !== null 
              ? `${indicators?.ascvd_risk?.score.toFixed(1)}%` 
              : 'N/A',
            indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score >= 15 ? 'danger' : indicators?.ascvd_risk?.score >= 7.5 ? 'elevated' : 'normal'
          )}`} id="ind-ascvd">
            <div className="ind-icon">⚡</div>
            <h4>Cardiovascular Risk (10-Yr)</h4>
            <div className="ind-val">
              {indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score !== null
                ? `${indicators.ascvd_risk.score.toFixed(1)}%`
                : 'No Data'}
            </div>
            <p className="ind-desc">10-year risk profile calculation.</p>
          </div>

          <div className={`indicator-card ${getRiskStatusClass(indicators?.diabetes_risk?.category)}`} id="ind-diabetes">
            <div className="ind-icon">🩸</div>
            <h4>Diabetes Risk Stage</h4>
            <div className="ind-val">{indicators?.diabetes_risk?.category || 'No Data'}</div>
            <p className="ind-desc">Determined from body mass and blood sugar.</p>
          </div>

          <div className={`indicator-card ${getRiskStatusClass(indicators?.kidney_gfr?.stage)}`} id="ind-kidney">
            <div className="ind-icon">💧</div>
            <h4>Kidney GFR Level</h4>
            <div className="ind-val">{indicators?.kidney_gfr?.stage || 'No Data'}</div>
            <p className="ind-desc">Creatinine extraction kidney stage.</p>
          </div>

        </div>
      </div>

      {/* Vitals Timeline Graph */}
      <VitalsTimeline />

      {/* Emergency SOS Broadcast Card */}
      <div className="card card-emergency full-width-card" style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.01) 100%)', margin: 0 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.8rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ color: '#ff4a4a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit', fontSize: '1.25rem', margin: 0 }}>
              🚨 Emergency SOS Broadcast Beacon
            </h3>
            <p style={{ fontSize: '0.82rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
              Broadcast location coordinates to dispatch nearest available ambulance
            </p>
          </div>
          <button 
            type="button" 
            id="trigger-sos-btn" 
            className="btn-primary" 
            style={{ background: '#ef4444', borderColor: '#ef4444', fontWeight: 700, padding: '0.5rem 1.2rem', fontSize: '0.88rem', boxShadow: '0 0 15px rgba(239,68,68,0.4)', cursor: 'pointer' }}
            onClick={handlePatientSosTrigger}
            disabled={!!activeSos}
          >
            {activeSos ? 'SOS Alert Transmitted' : 'Request Ambulance SOS'}
          </button>
        </div>

        {activeSos && (
          <div id="sos-status-container" style={{ marginTop: '1.2rem', padding: '1.2rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span 
                  className="active-pulse" 
                  id="sos-pulse" 
                  style={{ backgroundColor: activeSos.status === 'accepted' ? '#00e676' : '#ef4444', width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' }}
                ></span>
                <span id="sos-status-label" style={{ textTransform: 'uppercase', color: activeSos.status === 'accepted' ? '#00e676' : '#ff5252' }}>
                  {activeSos.status === 'accepted' ? 'Ambulance Dispatched' : 'SOS Broadcast Active'}
                </span>
              </div>
              <div id="sos-status-detail" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                {activeSos.status === 'pending' ? (
                  `Broadcast coordinates: ${activeSos.latitude?.toFixed(4) || 0}, ${activeSos.longitude?.toFixed(4) || 0}. Awaiting hospital acceptance...`
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, color: '#a7f3d0', marginBottom: '0.3rem' }}>ALERT ACCEPTED BY: {activeSos.accepted_by_hospital}</div>
                    <div>Contact Phone: <strong style={{ color: 'var(--color-secondary)' }}>{activeSos.accepted_by_phone}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>An emergency vehicle has been dispatched with medical attention. Please remain calm.</div>
                  </div>
                )}
              </div>
            </div>
            {activeSos.status === 'pending' && (
              <button
                onClick={handleCancelSos}
                className="btn-secondary btn-small"
                style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
              >
                Cancel False Alarm
              </button>
            )}
          </div>
        )}
      </div>

      {/* OTP and Locator Grid */}
      <div className="grid-layout full-width-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', margin: 0, padding: 0 }}>
        
        {/* OTP Card */}
        <div className="card card-otp" style={{ margin: 0 }}>
          <div className="card-header">
            <h3>Doctor Access Code (OTP)</h3>
            <p>Generate a temporary 6-digit access code valid for 60 seconds to permit clinician baselines updates</p>
          </div>
          <div className="otp-action-area" style={{ marginTop: '1.5rem' }}>
            <button 
              type="button" 
              id="generate-otp-btn" 
              onClick={handleGenerateOtp} 
              className="btn-primary full-width"
            >
              Generate Access OTP
            </button>
            
            {showOtp && (
              <div id="otp-display-container" className="otp-display-container">
                <div className="otp-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Secure Code
                </div>
                <div id="otp-code-value" className="otp-code-value">
                  {otpCode}
                </div>
                <div className="otp-timer" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Expires in <span id="otp-timer-value" style={{ color: '#ff5252', fontWeight: 600 }}>{otpSeconds}</span> seconds
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hospital Locator */}
        <div className="card card-locator" style={{ margin: 0 }}>
          <div className="card-header">
            <h3>Hospital Proximity Locator</h3>
            <p>Privately calculate distances to locate nearest clinical and dispatch facility centers</p>
          </div>
          <div className="locator-action-area" style={{ marginTop: '1.5rem' }}>
            <button 
              type="button" 
              id="find-hospitals-btn" 
              onClick={handleFindHospitals} 
              className="btn-secondary full-width"
              disabled={hospitalsLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {hospitalsLoading ? 'Searching...' : 'Find Nearest Hospitals'}
            </button>

            {hospitalsError && (
              <div className="alert alert-danger" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                {hospitalsError}
              </div>
            )}

            <div id="hospitals-list" className="hospitals-list" style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {hospitals.map((h, i) => (
                <div key={i} className="hospital-item" style={{ margin: 0 }}>
                  <div>
                    <strong style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{h.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{h.address}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>Phone: {h.phone}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: 'rgba(0, 229, 255, 0.1)', color: 'var(--color-secondary)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px' }}>
                      {h.distance_km?.toFixed(2)} km
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
