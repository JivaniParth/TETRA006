"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall, getWebSocketUrl } from '../services/api';
import CustomDropdown from './CustomDropdown.jsx';

export default function ClinicianDashboard() {
  const {
    email,
    escalations,
    fetchEscalations,
    sosBeacons,
    fetchEmergencies,
    selectedHospital,
    setSelectedHospital,
    showToast
  } = useApp();

  // Triage Comments States
  const [triageComments, setTriageComments] = useState({});

  // Hospital selectors
  const [hospLabel, setHospLabel] = useState('General Dispatch Unit');
  const [phoneLabel, setPhoneLabel] = useState('+1 800-555-0100');

  // Update layout header depending on selected hospital override
  useEffect(() => {
    if (selectedHospital) {
      const parts = selectedHospital.split('|');
      setHospLabel(parts[0]);
      setPhoneLabel(parts[3] || '+1 800-SWASTHYA');
    } else {
      setHospLabel('General Dispatch Unit');
      setPhoneLabel('+1 800-555-0100');
    }
  }, [selectedHospital]);

  // WebSocket real-time subscription + 4-second polling fallback
  useEffect(() => {
    fetchEmergencies();
    let ws = null;
    try {
      const wsUrl = getWebSocketUrl('/clinician/ws/emergencies');
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'emergency_accepted' || data.event === 'new_emergency' || data.event === 'emergency_cancelled') {
            fetchEmergencies();
          }
        } catch (e) {
          console.error("Error parsing WebSocket event:", e);
        }
      };
    } catch (e) {
      console.warn("WebSocket unavailable, using polling fallback", e);
    }

    const interval = setInterval(() => {
      fetchEmergencies();
    }, 4000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [selectedHospital]);

  // Set up initial load of escalations
  useEffect(() => {
    fetchEscalations();
  }, []);

  const handleResolveEscalation = async (id) => {
    const comments = triageComments[id]?.trim() || 'Escalation triaged and resolved by clinician.';
    try {
      await apiCall(`/clinician/escalations/${id}/resolve?comments=${encodeURIComponent(comments)}`, {
        method: 'POST'
      });
      fetchEscalations();
      // Clear comment input
      setTriageComments(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      showToast(`Failed to resolve escalation: ${err.message}`, 'danger');
    }
  };

  const handleAcceptSos = async (id) => {
    const payload = {};
    if (selectedHospital) {
      const parts = selectedHospital.split('|');
      payload.hospital_name = parts[0];
      payload.phone = parts[3] || '+1 800-SWASTHYA';
    }

    if (!window.confirm('Confirm dispatching emergency response unit for this patient? This will accept the alert and notify the patient immediately.')) {
      return;
    }

    try {
      await apiCall(`/clinician/emergencies/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Emergency SOS Accepted! Dispatch logged and patient notified.', 'success');
      fetchEmergencies();
    } catch (err) {
      showToast(`Failed to accept emergency alert: ${err.message}`, 'danger');
    }
  };

  return (
    <div id="tab-dashboard" className="tab-content grid-layout full-width-card clinician-grid">
      {/* Left Column: Escalations Queue */}
      <div className="card clinician-card" style={{ margin: 0, width: '100%' }}>
        <div className="card-header clin-header">
          <div>
            <h2>Clinician Triage & Escalations</h2>
            <p>Active alert cases triggered by patient vital thresholds</p>
          </div>
          <button onClick={fetchEscalations} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh Queue
          </button>
        </div>

        <div className="escalations-queue">
          {escalations.length === 0 ? (
            <p className="empty-state">No active clinical escalations in queue. System is fully stable.</p>
          ) : (
            escalations.map((item) => (
              <div 
                key={item.id} 
                className={`escalation-card ${item.severity_tier === 'important' ? 'escal-important' : ''}`}
              >
                <div className="escal-meta">
                  <span>Patient ID: {item.patient_id}</span>
                  <span className={`severity-${item.severity_tier}`}>{item.severity_tier.toUpperCase()} severity</span>
                </div>
                <div className="escal-reason">{item.reason}</div>
                <div className="escal-details">Triggered: {new Date(item.created_at).toLocaleString()}</div>
                <div className="escal-actions">
                  <input 
                    type="text" 
                    placeholder="Triage comment (e.g. Advised ER, Scheduled consult)" 
                    style={{ flex: 1, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    value={triageComments[item.id] || ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      setTriageComments(prev => ({ ...prev, [item.id]: text }));
                    }}
                  />
                  <button 
                    onClick={() => handleResolveEscalation(item.id)} 
                    className="btn-primary btn-small"
                  >
                    Acknowledge & Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Emergency SOS Dashboard */}
      <div className="card clinician-card" style={{ margin: 0, width: '100%', borderColor: 'rgba(239, 68, 68, 0.35)', background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(0,0,0,0) 100%)' }}>
        <div className="card-header clin-header" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: '0.8rem' }}>
          <div>
            <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>🚨 Immediate Emergency Dispatch</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Real-time patient SOS beacons within 50 km proximity radius</p>
          </div>
          <button 
            onClick={fetchEmergencies} 
            className="btn-secondary btn-small" 
            style={{ borderColor: 'rgba(239,68,68,0.4)' }}
          >
            🔄 Refresh Beacon List
          </button>
        </div>
        
        <div id="clinician-facility-badge" style={{ margin: '1rem 0', padding: '0.8rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Registered Facility</span>
            <strong id="clin-facility-label" style={{ color: 'var(--color-secondary)', fontSize: '0.95rem' }}>{hospLabel}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Dispatch Contact</span>
            <span id="clin-phone-label" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{phoneLabel}</span>
          </div>
        </div>

        {/* Override dropdown */}
        <div style={{ marginBottom: '1rem' }}>
          <details style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <summary>Switch / Override Facility Location</summary>
            <CustomDropdown
              options={[
                { value: '', label: '-- Use Registered Account Facility --' },
                { value: 'Apollo Hospitals Bangalore|12.9238|77.5996|+91 80 2630 4050', label: 'Apollo Hospitals Bangalore (Phone: +91 80 2630 4050)' },
                { value: 'Fortis Hospital Bangalore|12.9248|77.6001|+91 80 6621 4444', label: 'Fortis Hospital Bangalore (Phone: +91 80 6621 4444)' },
                { value: 'Lilavati Hospital Mumbai|19.0515|72.8285|+91 22 2675 1000', label: 'Lilavati Hospital Mumbai (Phone: +91 22 2675 1000)' },
                { value: 'Kokilaben Dhirubhai Ambani Hospital Mumbai|19.1315|72.8252|+91 22 3099 9999', label: 'Kokilaben Dhirubhai Ambani Hospital Mumbai (Phone: +91 22 3099 9999)' },
                { value: 'NewYork-Presbyterian Hospital|40.8424|-73.9429|+1 212-305-2500', label: 'NewYork-Presbyterian Hospital (Phone: +1 212-305-2500)' },
                { value: 'Mount Sinai Hospital|40.7899|-73.9528|+1 212-241-6500', label: 'Mount Sinai Hospital (Phone: +1 212-241-6500)' },
                { value: 'NYU Langone Health|40.7423|-73.9737|+1 212-263-7300', label: 'NYU Langone Health (Phone: +1 212-263-7300)' }
              ]}
              value={selectedHospital}
              onChange={setSelectedHospital}
              placeholder="Use Registered Account Facility"
            />
          </details>
        </div>

        <div id="clinician-sos-queue" className="escalations-queue">
          {sosBeacons.length === 0 ? (
            <p className="empty-state" style={{ color: 'var(--text-muted)' }}>No active patient SOS alerts within your 50 km facility radius. Monitoring active signals...</p>
          ) : (
            sosBeacons.map((alert) => (
              <div 
                key={alert.id}
                className="escalation-card" 
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(255,255,255,0) 100%)', padding: '1rem', borderRadius: '8px', marginBottom: '0.8rem' }}
              >
                <div className="escal-meta" style={{ color: '#ff5252', fontWeight: 700, display: 'flex', justifycontent: 'space-between', fontSize: '0.85rem' }}>
                  <span>🚨 IMMEDIATE PATIENT SOS</span>
                  <span style={{ backgroundColor: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px', color: '#ff6b6b' }}>
                    {alert.distance_km !== null ? `${alert.distance_km.toFixed(2)} km away` : 'Nearby'}
                  </span>
                </div>
                <div className="escal-reason" style={{ fontSize: '1rem', fontWeight: 700, margin: '0.4rem 0', color: '#fff' }}>Patient: {alert.patient_email}</div>
                <div className="escal-details" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  <div>GPS Target: <strong>{alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}</strong></div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Beacon Time: {new Date(alert.created_at).toLocaleTimeString()}</div>
                </div>
                <div className="escal-actions" style={{ marginTop: '0.8rem' }}>
                  <button 
                    type="button" 
                    className="btn-primary full-width" 
                    style={{ background: '#ef4444', borderColor: '#ef4444', fontWeight: 700 }}
                    onClick={() => handleAcceptSos(alert.id)}
                  >
                    🚨 Accept SOS & Send Ambulance
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
