"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';
import CustomDropdown from './CustomDropdown.jsx';

export default function PatientVitalsForm() {
  const { userId, fetchIndicators, fetchTimeline, showToast } = useApp();

  // Vitals entry States
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [sugar, setSugar] = useState('');
  const [sugarType, setSugarType] = useState('fasting');
  const [heartRate, setHeartRate] = useState('');
  const [creatinine, setCreatinine] = useState('');
  
  const [vitalsMsg, setVitalsMsg] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleVitalsSubmit = async (e) => {
    e.preventDefault();
    setVitalsMsg({ text: '', type: '' });
    setIsLoading(true);

    const payload = {};
    if (systolic) payload.systolic_bp = parseInt(systolic);
    if (diastolic) payload.diastolic_bp = parseInt(diastolic);
    if (sugar) {
      payload.blood_sugar = parseFloat(sugar);
      payload.blood_sugar_type = sugarType;
    }
    if (heartRate) payload.heart_rate = parseInt(heartRate);
    if (creatinine) payload.creatinine = parseFloat(creatinine);

    if (Object.keys(payload).length === 0) {
      showToast('Please fill out at least one vital parameter to log', 'danger');
      setVitalsMsg({ text: 'Please fill out at least one vital parameter.', type: 'danger' });
      setIsLoading(false);
      return;
    }

    try {
      await apiCall(`/patient/${userId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setVitalsMsg({ text: 'Vitals successfully logged! Health indicators updated.', type: 'success' });
      
      // Clear forms
      setSystolic('');
      setDiastolic('');
      setSugar('');
      setHeartRate('');
      setCreatinine('');

      // Refresh dashboard indicators cache
      fetchIndicators();
      fetchTimeline();
    } catch (err) {
      setVitalsMsg({ text: err.message || 'Failed to submit vitals.', type: 'danger' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Log Your Vital Signs</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Log your daily diagnostics to update your cardiovascular, diabetes, and kidney wellness risk percentages</p>
      </div>

      <div className="card card-vitals" style={{ width: '100%' }}>
        <div className="card-header">
          <h3>Vitals Entry Form</h3>
          <p>You can input one or multiple metrics. Unspecified values will retain their historical settings.</p>
        </div>

        <form onSubmit={handleVitalsSubmit} noValidate className="form-grid" style={{ marginTop: '1.5rem' }}>
          
          <div className="form-group">
            <label htmlFor="vitals-sbp">Systolic BP (mmHg)</label>
            <input 
              type="number" 
              id="vitals-sbp" 
              min="50" 
              max="250" 
              placeholder="e.g. 120"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="vitals-dbp">Diastolic BP (mmHg)</label>
            <input 
              type="number" 
              id="vitals-dbp" 
              min="30" 
              max="150" 
              placeholder="e.g. 80"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="vitals-sugar">Blood Sugar (mg/dL)</label>
            <input 
              type="number" 
              step="0.1" 
              id="vitals-sugar" 
              min="20" 
              max="600" 
              placeholder="e.g. 98.5"
              value={sugar}
              onChange={(e) => setSugar(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="vitals-sugar-type">Blood Sugar Type</label>
            <CustomDropdown
              options={[
                { value: 'fasting', label: 'Fasting' },
                { value: 'random', label: 'Random' },
                { value: 'post_prandial', label: 'Post Prandial' }
              ]}
              value={sugarType}
              onChange={setSugarType}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="vitals-hr">Heart Rate (bpm)</label>
            <input 
              type="number" 
              id="vitals-hr" 
              min="30" 
              max="220" 
              placeholder="e.g. 72"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="vitals-creatinine">Serum Creatinine (mg/dL)</label>
            <input 
              type="number" 
              step="0.01" 
              id="vitals-creatinine" 
              min="0.1" 
              max="15.0" 
              placeholder="e.g. 0.9"
              value={creatinine}
              onChange={(e) => setCreatinine(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn-primary full-width" style={{ gridColumn: 'span 2', height: '48px', fontWeight: '700', marginTop: '1rem' }} disabled={isLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            {isLoading ? 'Saving Entries...' : 'Save Vital Entries'}
          </button>

        </form>

        {vitalsMsg.text && (
          <div className={`alert alert-${vitalsMsg.type}`} style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            {vitalsMsg.text}
          </div>
        )}
      </div>

    </div>
  );
}
