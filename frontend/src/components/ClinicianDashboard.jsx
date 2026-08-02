"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';
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
    retrievedPatient,
    setRetrievedPatient
  } = useApp();

  // Triage Comments States
  const [triageComments, setTriageComments] = useState({});

  // Hospital selectors
  const [hospLabel, setHospLabel] = useState('General Dispatch Unit');
  const [phoneLabel, setPhoneLabel] = useState('+1 800-555-0100');

  // Patient history retriever form
  const [patientEmail, setPatientEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [retrieveStatus, setRetrieveStatus] = useState({ text: '', type: '' });

  // Patient updates form
  const [activeMeds, setActiveMeds] = useState('');
  const [operations, setOperations] = useState('');
  const [updateOtp, setUpdateOtp] = useState('');
  const [updateStatus, setUpdateStatus] = useState({ text: '', type: '' });

  // Update layout header depending on selected hospital override
  useEffect(() => {
    if (selectedHospital) {
      const parts = selectedHospital.split('|');
      setHospLabel(parts[0]);
      setPhoneLabel(parts[3] || '+1 800-MEDGUARD');
    } else {
      setHospLabel('General Dispatch Unit');
      setPhoneLabel('+1 800-555-0100');
    }
  }, [selectedHospital]);

  // Set up 4-second polling for emergencies
  useEffect(() => {
    fetchEmergencies();
    const interval = setInterval(() => {
      fetchEmergencies();
    }, 4000);
    return () => clearInterval(interval);
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
      alert(`Failed to resolve escalation: ${err.message}`);
    }
  };

  const handleAcceptSos = async (id) => {
    const payload = {};
    if (selectedHospital) {
      const parts = selectedHospital.split('|');
      payload.hospital_name = parts[0];
      payload.phone = parts[3] || '+1 800-MEDGUARD';
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
      alert('Emergency SOS Accepted! Dispatch logged and patient notified.');
      fetchEmergencies();
    } catch (err) {
      alert(`Failed to accept emergency alert: ${err.message}`);
    }
  };

  const handleRetrieveHistory = async (e) => {
    e.preventDefault();
    setRetrieveStatus({ text: '', type: '' });
    setRetrievedPatient(null);

    try {
      const data = await apiCall('/clinician/patient-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_email: patientEmail, otp_code: otpCode })
      });

      setRetrievedPatient(data);
      
      // Autofill updates
      const p = data.profile || {};
      setActiveMeds(p.active_medications ? p.active_medications.join(', ') : '');
      setOperations(p.past_operations ? p.past_operations.join(', ') : '');
      setUpdateOtp('');
    } catch (err) {
      setRetrieveStatus({ text: `Access Denied: ${err.message}`, type: 'danger' });
    }
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    setUpdateStatus({ text: '', type: '' });

    const medsArray = activeMeds ? activeMeds.split(',').map(s => s.trim()).filter(Boolean) : [];
    const opsArray = operations ? operations.split(',').map(s => s.trim()).filter(Boolean) : [];

    try {
      await apiCall('/clinician/patient-history/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_email: retrievedPatient.email,
          otp_code: updateOtp,
          active_medications: medsArray,
          past_operations: opsArray
        })
      });

      setUpdateStatus({ text: 'Patient record successfully updated and Kafka audit log transmitted!', type: 'success' });
      
      setTimeout(() => {
        setRetrievedPatient(null);
        setPatientEmail('');
        setOtpCode('');
        setUpdateStatus({ text: '', type: '' });
      }, 3000);
    } catch (err) {
      setUpdateStatus({ text: `Update Failed: ${err.message}`, type: 'danger' });
    }
  };

  return (
    <div id="tab-dashboard" className="tab-content grid-layout full-width-card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start', maxWidth: '100%' }}>
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

      {/* OTP Retriever Folder & Update Baseline form */}
      <div className="card card-clinician-otp full-width-card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3>Retrieve Patient History (Email + OTP Passcode)</h3>
          <p>Submit patient's registered email alongside the temporary 6-digit access code generated by their client</p>
        </div>
        
        <form onSubmit={handleRetrieveHistory} className="form-grid" style={{ marginTop: '1.5rem' }}>
          <div className="form-group">
            <label htmlFor="clin-patient-email">Patient Email Address</label>
            <input 
              type="email" 
              id="clin-patient-email" 
              required 
              placeholder="e.g. patient@example.com"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="clin-otp-code">Patient Access OTP Code</label>
            <input 
              type="text" 
              id="clin-otp-code" 
              required 
              placeholder="e.g. 482019" 
              maxLength="6"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary full-width" style={{ alignSelf: 'end', height: '46px' }}>Retrieve Records</button>
        </form>
        
        {retrieveStatus.text && (
          <div className={`alert alert-${retrieveStatus.type}`} style={{ marginTop: '1rem' }}>
            {retrieveStatus.text}
          </div>
        )}

        {/* Retrieved Folder Details */}
        {retrievedPatient && (
          <div id="retrieved-patient-record" className="retrieved-record">
            <div className="record-meta-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h4>Retrieved Medical Folder for <span id="retrieved-patient-email" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{retrievedPatient.email}</span></h4>
              <span className="badge badge-success" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500 }}>OTP Authorized</span>
            </div>
            
            <div className="grid-layout" style={{ gap: '1.5rem' }}>
              {/* Profile Details */}
              <div className="card inner-card" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', color: 'var(--color-primary)' }}>Intake Profile Baseline</h4>
                <div id="retrieved-profile-data" style={{ fontSize: '0.9rem', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Age / Gender / Race:</strong> {retrievedPatient.profile?.age || 'N/A'} yrs | {retrievedPatient.profile?.gender || 'N/A'} | {retrievedPatient.profile?.race || 'N/A'}</div>
                  <div><strong>Height / Weight:</strong> {retrievedPatient.profile?.height || 'N/A'} cm | {retrievedPatient.profile?.weight || 'N/A'} kg</div>
                  <div><strong>Active Medications:</strong> {retrievedPatient.profile?.active_medications ? retrievedPatient.profile.active_medications.join(', ') : 'None'}</div>
                  <div><strong>Allergies:</strong> {retrievedPatient.profile?.allergies ? retrievedPatient.profile.allergies.join(', ') : 'None'}</div>
                  <div><strong>Surgeries / Operations:</strong> {retrievedPatient.profile?.past_operations ? retrievedPatient.profile.past_operations.join(', ') : 'None'}</div>
                  <div><strong>Chronic Illnesses:</strong> {retrievedPatient.profile?.medical_history ? retrievedPatient.profile.medical_history.join(', ') : 'None'}</div>
                  <div><strong>Additional Baseline Notes:</strong> <span style={{ color: 'var(--color-secondary)' }}>{retrievedPatient.profile?.additional_notes || 'None'}</span></div>
                </div>
              </div>

              {/* Vitals chronology list */}
              <div className="card inner-card" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', color: 'var(--color-primary)' }}>Vitals Chronology</h4>
                <div id="retrieved-vitals-data" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {(!retrievedPatient.vitals || retrievedPatient.vitals.length === 0) ? (
                    <div className="empty-state">No historical vitals logged.</div>
                  ) : (
                    retrievedPatient.vitals.map((v, i) => (
                      <div key={i} style={{ padding: '0.6rem', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{new Date(v.recorded_at).toLocaleString()}</div>
                        <div style={{ marginTop: '0.2rem', lineHeight: '1.4' }}>
                          BP: {v.systolic_bp || 'N/A'}/{v.diastolic_bp || 'N/A'} mmHg
                          {v.blood_sugar && ` | Blood Sugar: ${v.blood_sugar} mg/dL (${v.blood_sugar_type || 'unclassified'})`}
                          {v.heart_rate && ` | Heart Rate: ${v.heart_rate} bpm`}
                          {v.creatinine && ` | Creatinine: ${v.creatinine} mg/dL`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Commit update Form */}
            <div className="card inner-card" style={{ padding: '1.5rem', marginTop: '1.5rem', width: '100%' }}>
              <h4 style={{ color: 'var(--color-secondary)', marginBottom: '0.5rem' }}>Update Patient Profile Medications & Operations</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>Updates must be signed off by transmitting a fresh patient-provided 6-digit access OTP code.</p>
              
              <form onSubmit={handleUpdateRecord} className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="clin-update-meds">Active Medications (comma separated)</label>
                  <input 
                    type="text" 
                    id="clin-update-meds" 
                    placeholder="e.g. Lisinopril, Metformin, Atorvastatin"
                    value={activeMeds}
                    onChange={(e) => setActiveMeds(e.target.value)}
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="clin-update-operations">Past Operations / Surgeries (comma separated)</label>
                  <input 
                    type="text" 
                    id="clin-update-operations" 
                    placeholder="e.g. Appendectomy, Coronary Bypass"
                    value={operations}
                    onChange={(e) => setOperations(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="clin-update-otp">New Authorization OTP Code</label>
                  <input 
                    type="text" 
                    id="clin-update-otp" 
                    required 
                    placeholder="e.g. 981723" 
                    maxLength="6"
                    value={updateOtp}
                    onChange={(e) => setUpdateOtp(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary full-width" style={{ alignSelf: 'end', height: '46px' }}>Commit Baseline Changes</button>
              </form>
              
              {updateStatus.text && (
                <div className={`alert alert-${updateStatus.type}`} style={{ marginTop: '1rem' }}>
                  {updateStatus.text}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
