"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';

export default function ClinicianRecords() {
  const { retrievedPatient, setRetrievedPatient, showToast } = useApp();

  // Patient history retriever form
  const [patientEmail, setPatientEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [retrieveStatus, setRetrieveStatus] = useState({ text: '', type: '' });

  // Patient updates form
  const [activeMeds, setActiveMeds] = useState('');
  const [operations, setOperations] = useState('');
  const [updateOtp, setUpdateOtp] = useState('');
  const [updateStatus, setUpdateStatus] = useState({ text: '', type: '' });

  const handleRetrieveHistory = async (e) => {
    e.preventDefault();
    setRetrieveStatus({ text: '', type: '' });

    if (!patientEmail || !patientEmail.trim()) {
      showToast('Please enter the patient email address', 'danger');
      return;
    }
    if (!otpCode || !otpCode.trim()) {
      showToast('Please enter the patient access OTP code', 'danger');
      return;
    }

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

    if (!updateOtp || !updateOtp.trim()) {
      showToast('Please enter the authorization OTP code to commit changes', 'danger');
      return;
    }

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

      setUpdateStatus({ text: 'Patient record successfully updated!', type: 'success' });
      
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
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* Search Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Patient Medical Records Lookup</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Authorized access to patient files requiring patient-side generated OTP verification passcodes</p>
      </div>

      {/* OTP Retriever Folder Card */}
      <div className="card card-clinician-otp" style={{ width: '100%', marginBottom: '2rem' }}>
        <div className="card-header">
          <h3>Retrieve Patient History</h3>
          <p>Submit patient's registered email alongside the temporary 6-digit access code generated on their dashboard</p>
        </div>
        
        <form onSubmit={handleRetrieveHistory} noValidate className="form-grid" style={{ marginTop: '1.5rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="clin-otp-code">Patient Access OTP Code</label>
              <span style={{ color: 'var(--color-warning)', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.05em' }}>⚠️ SECURITY OTP REQUIRED</span>
            </div>
            <input 
              type="text" 
              id="clin-otp-code" 
              required 
              placeholder="e.g. 482019" 
              maxLength="6"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="otp-input-highlight"
            />
          </div>
          
          <button type="submit" className="btn-primary full-width" style={{ alignSelf: 'end', height: '46px' }}>
            Retrieve Records
          </button>
        </form>
        
        {retrieveStatus.text && (
          <div className={`alert alert-${retrieveStatus.type}`} style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            {retrieveStatus.text}
          </div>
        )}
      </div>

      {/* Retrieved Folder Details */}
      {retrievedPatient && (
        <div id="retrieved-patient-record" className="retrieved-record" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="card" style={{ width: '100%', marginBottom: '2rem' }}>
            <div className="record-meta-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Retrieved Medical Folder for <span id="retrieved-patient-email" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{retrievedPatient.email}</span></h4>
              <span className="badge badge-success" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500 }}>OTP Authorized</span>
            </div>
            
            <div className="grid-layout" style={{ gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
              {/* Profile Details */}
              <div className="card inner-card" style={{ padding: '1.5rem', margin: 0 }}>
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
              <div className="card inner-card" style={{ padding: '1.5rem', margin: 0 }}>
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
          </div>

          {/* Commit update Form */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <h3 style={{ color: 'var(--color-secondary)' }}>Update Medications & Surgeries</h3>
              <p>Baseline updates require clinical signature authentication using a fresh patient passcode</p>
            </div>
            
            <form onSubmit={handleUpdateRecord} noValidate className="form-grid" style={{ marginTop: '1.5rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="clin-update-otp">New Authorization OTP Code</label>
                  <span style={{ color: 'var(--color-warning)', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.05em' }}>⚠️ SECURITY OTP REQUIRED</span>
                </div>
                <input 
                  type="text" 
                  id="clin-update-otp" 
                  required 
                  placeholder="e.g. 981723" 
                  maxLength="6"
                  value={updateOtp}
                  onChange={(e) => setUpdateOtp(e.target.value)}
                  className="otp-input-highlight"
                />
              </div>
              
              <button type="submit" className="btn-primary full-width" style={{ alignSelf: 'end', height: '46px' }}>
                Commit Baseline Changes
              </button>
            </form>
            
            {updateStatus.text && (
              <div className={`alert alert-${updateStatus.type}`} style={{ marginTop: '1.2rem', textAlign: 'center' }}>
                {updateStatus.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
