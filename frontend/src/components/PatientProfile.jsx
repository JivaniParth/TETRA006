"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';
import VitalsTimeline from './VitalsTimeline.jsx';
import CustomDropdown from './CustomDropdown.jsx';

export default function PatientProfile() {
  const {
    userId,
    profile,
    setProfile,
    indicators,
    fetchIndicators,
    fetchHistory,
    fetchTimeline,
    activeSos,
    setActiveSos,
    checkActiveSos
  } = useApp();

  // Vitals form state
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [sugar, setSugar] = useState('');
  const [sugarType, setSugarType] = useState('fasting');
  const [heartRate, setHeartRate] = useState('');
  const [creatinine, setCreatinine] = useState('');
  const [vitalsMsg, setVitalsMsg] = useState({ text: '', type: '' });

  // Intake profile form state
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [race, setRace] = useState('');
  const [sleepDur, setSleepDur] = useState('');
  const [sleepQual, setSleepQual] = useState('good');
  const [alcohol, setAlcohol] = useState('none');
  const [tobacco, setTobacco] = useState('none');
  const [smokeCheck, setSmokeCheck] = useState(false);
  const [activeCheck, setActiveCheck] = useState(true);
  const [famCardioCheck, setFamCardioCheck] = useState(false);
  const [famDiabetesCheck, setFamDiabetesCheck] = useState(false);
  const [meds, setMeds] = useState('');
  const [allergies, setAllergies] = useState('');
  const [history, setHistory] = useState('');
  const [operations, setOperations] = useState('');
  const [notes, setNotes] = useState('');
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  // OTP generator states
  const [otpCode, setOtpCode] = useState('');
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [showOtp, setShowOtp] = useState(false);

  // Hospital locator states
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [hospitalsError, setHospitalsError] = useState('');

  // SOS tracking interval state
  const [sosIntervalId, setSosIntervalId] = useState(null);

  // Initialize form fields once profile loads
  useEffect(() => {
    if (profile) {
      setAge(profile.age || '');
      setGender(profile.gender || '');
      setHeight(profile.height || '');
      setWeight(profile.weight || '');
      setRace(profile.race || '');
      setSleepDur(profile.sleep_duration || '');
      setSleepQual(profile.sleep_quality || 'good');
      setAlcohol(profile.alcohol_consumption || 'none');
      setTobacco(profile.tobacco_consumption || 'none');
      setSmokeCheck(profile.lifestyle_smoke || false);
      setActiveCheck(profile.lifestyle_active ?? true);
      setFamCardioCheck(profile.family_history_cardiovascular || false);
      setFamDiabetesCheck(profile.family_history_diabetes || false);
      setMeds(profile.active_medications ? profile.active_medications.join(', ') : '');
      setAllergies(profile.allergies ? profile.allergies.join(', ') : '');
      setHistory(profile.medical_history ? profile.medical_history.join(', ') : '');
      setOperations(profile.past_operations ? profile.past_operations.join(', ') : '');
      setNotes(profile.additional_notes || '');
    }
  }, [profile]);

  // Set up polling for SOS status if it is pending
  useEffect(() => {
    if (activeSos && activeSos.status === 'pending') {
      if (!sosIntervalId) {
        const interval = setInterval(async () => {
          const freshSos = await checkActiveSos();
          if (!freshSos) {
            clearInterval(interval);
            setSosIntervalId(null);
          } else if (freshSos.status === 'accepted') {
            clearInterval(interval);
            setSosIntervalId(null);
          }
        }, 4000);
        setSosIntervalId(interval);
      }
    } else {
      if (sosIntervalId) {
        clearInterval(sosIntervalId);
        setSosIntervalId(null);
      }
    }
    return () => {
      if (sosIntervalId) clearInterval(sosIntervalId);
    };
  }, [activeSos]);

  // Clean up timer on unmount
  useEffect(() => {
    let interval;
    if (otpSeconds > 0) {
      interval = setInterval(() => {
        setOtpSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setShowOtp(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSeconds]);

  // Vitals submit
  const handleVitalsSubmit = async (e) => {
    e.preventDefault();
    setVitalsMsg({ text: '', type: '' });

    const payload = {};
    if (sbp) payload.systolic_bp = parseInt(sbp);
    if (dbp) payload.diastolic_bp = parseInt(dbp);
    if (sugar) {
      payload.blood_sugar = parseFloat(sugar);
      payload.blood_sugar_type = sugarType;
    }
    if (heartRate) payload.heart_rate = parseInt(heartRate);
    if (creatinine) payload.creatinine = parseFloat(creatinine);

    if (Object.keys(payload).length === 0) {
      setVitalsMsg({ text: 'Please log at least one vital parameter.', type: 'danger' });
      return;
    }

    try {
      await apiCall(`/patient/${userId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setVitalsMsg({ text: 'Vitals logged successfully!', type: 'success' });
      setSbp('');
      setDbp('');
      setSugar('');
      setHeartRate('');
      setCreatinine('');

      // Refresh cached details
      fetchIndicators();
      fetchHistory();
      fetchTimeline();
      
      setTimeout(() => setVitalsMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setVitalsMsg({ text: err.message, type: 'danger' });
    }
  };

  // Profile submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });

    const activeMeds = meds ? meds.split(',').map(s => s.trim()).filter(Boolean) : [];
    const rawAllergies = allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [];
    const rawHistory = history ? history.split(',').map(s => s.trim()).filter(Boolean) : [];
    const rawOperations = operations ? operations.split(',').map(s => s.trim()).filter(Boolean) : [];

    const payload = {
      age: parseInt(age),
      gender,
      race,
      height: parseFloat(height),
      weight: parseFloat(weight),
      lifestyle_smoke: smokeCheck,
      lifestyle_active: activeCheck,
      family_history_cardiovascular: famCardioCheck,
      family_history_diabetes: famDiabetesCheck,
      sleep_duration: parseFloat(sleepDur) || 7.0,
      sleep_quality: sleepQual,
      alcohol_consumption: alcohol,
      tobacco_consumption: tobacco,
      active_medications: activeMeds,
      allergies: rawAllergies,
      medical_history: rawHistory,
      past_operations: rawOperations,
      additional_notes: notes.trim()
    };

    try {
      const updated = await apiCall(`/patient/${userId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setProfile(updated);
      setProfileMsg({ text: 'Patient profile successfully updated!', type: 'success' });
      fetchIndicators();
      setTimeout(() => setProfileMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setProfileMsg({ text: err.message, type: 'danger' });
    }
  };

  // Generate Clinician Access OTP
  const handleGenerateOtp = async () => {
    try {
      const data = await apiCall('/patient/access-code/generate', { method: 'POST' });
      const rawCode = data.otp_code;
      setOtpCode(rawCode.substring(0, 3) + ' ' + rawCode.substring(3));
      setOtpSeconds(data.expires_in_seconds || 60);
      setShowOtp(true);
    } catch (err) {
      alert('Failed to generate OTP: ' + err.message);
    }
  };

  // Emergency SOS Broadcast Beacon
  const handlePatientSosTrigger = () => {
    setActiveSos({
      status: 'pending',
      latitude: 0,
      longitude: 0,
      accepted_by_hospital: null,
      accepted_by_phone: null
    });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        await sendSosRequest(lat, lon);
      },
      async (err) => {
        console.warn('Geolocation blocked/denied. Using default city coordinates.', err);
        const fallbackLat = 12.9250;
        const fallbackLon = 77.6000;
        await sendSosRequest(fallbackLat, fallbackLon);
      }
    );
  };

  const sendSosRequest = async (lat, lon) => {
    try {
      const result = await apiCall(`/patient/${userId}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon })
      });
      setActiveSos(result);
    } catch (err) {
      alert('Broadcast Failed: ' + err.message + '. Please contact emergency services.');
      setActiveSos(null);
    }
  };

  // Locate Nearby Hospitals
  const handleFindHospitals = () => {
    setHospitalsLoading(true);
    setHospitalsError('');
    setHospitals([]);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const list = await apiCall(`/patient/hospitals/nearby?latitude=${lat}&longitude=${lon}`);
          setHospitals(list);
        } catch (e) {
          setHospitalsError('Error locator service: ' + e.message);
        } finally {
          setHospitalsLoading(false);
        }
      },
      (err) => {
        console.warn('Geolocation blocked. Searching Bangalore defaults.', err);
        const fallbackLat = 12.925;
        const fallbackLon = 77.600;
        setTimeout(async () => {
          try {
            const list = await apiCall(`/patient/hospitals/nearby?latitude=${fallbackLat}&longitude=${fallbackLon}`);
            setHospitals(list);
          } catch (e) {
            setHospitalsError('Error locator service: ' + e.message);
          } finally {
            setHospitalsLoading(false);
          }
        }, 800);
      }
    );
  };

  // Helper status tags
  const getRiskStatusClass = (val, stage) => {
    if (!val || val === 'No Data' || val === 'N/A') return 'risk-normal';
    
    const lowerVal = String(val).toLowerCase();
    const lowerStage = String(stage || '').toLowerCase();
    
    if (lowerVal.includes('emergency') || lowerVal.includes('crisis') || 
        lowerVal.includes('failure') || lowerVal.includes('severe') || 
        lowerVal.includes('high') || lowerStage === 'danger') {
      return 'risk-danger';
    }
    
    if (lowerVal.includes('elevated') || lowerVal.includes('pre-') || 
        lowerVal.includes('stage') || lowerStage === 'elevated') {
      return 'risk-elevated';
    }
    
    return 'risk-normal';
  };

  return (
    <div id="tab-profile" className="tab-content grid-layout">
      {/* Vitals Form */}
      <div className="card card-vitals">
        <div className="card-header">
          <h3>Log Current Vitals</h3>
          <p>Input recent clinical measurements below</p>
        </div>
        <form onSubmit={handleVitalsSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="vitals-sbp">Systolic BP (mmHg)</label>
            <input 
              type="number" 
              id="vitals-sbp" 
              min="50" 
              max="250" 
              placeholder="e.g. 120"
              value={sbp}
              onChange={(e) => setSbp(e.target.value)}
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
              value={dbp}
              onChange={(e) => setDbp(e.target.value)}
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
              placeholder="e.g. 95.0"
              value={sugar}
              onChange={(e) => setSugar(e.target.value)}
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
            />
          </div>
          <div className="form-group full-width">
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
            />
          </div>
          <button type="submit" className="btn-primary full-width">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save Vital Entries
          </button>
        </form>
        {vitalsMsg.text && (
          <div className={`alert alert-${vitalsMsg.type}`} style={{ marginTop: '1rem', textAlign: 'center' }}>
            {vitalsMsg.text}
          </div>
        )}
      </div>

      {/* Profile Form */}
      <div className="card card-profile">
        <div className="card-header">
          <h3>Intake Profile & Medical History</h3>
          <p>Help us calculate safety warning thresholds and score risks</p>
        </div>
        <form onSubmit={handleProfileSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="prof-age">Age</label>
            <input 
              type="number" 
              id="prof-age" 
              required 
              min="0" 
              max="120" 
              placeholder="Years"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-gender">Gender</label>
            <CustomDropdown
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' }
              ]}
              value={gender}
              onChange={setGender}
              placeholder="Select Gender"
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-height">Height (cm)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-height" 
              required 
              placeholder="cm"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-weight">Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-weight" 
              required 
              placeholder="kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-race">Race / Ethnic Group</label>
            <CustomDropdown
              options={[
                { value: 'white', label: 'White / Caucasian' },
                { value: 'african_american', label: 'African American' },
                { value: 'asian', label: 'Asian' },
                { value: 'hispanic', label: 'Hispanic' },
                { value: 'other', label: 'Other' }
              ]}
              value={race}
              onChange={setRace}
              placeholder="Select Race / Ethnic Group"
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-sleep-dur">Sleep Duration (hrs)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-sleep-dur" 
              placeholder="e.g. 7.5"
              value={sleepDur}
              onChange={(e) => setSleepDur(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-sleep-qual">Sleep Quality</label>
            <CustomDropdown
              options={[
                { value: 'good', label: 'Good' },
                { value: 'fair', label: 'Fair' },
                { value: 'poor', label: 'Poor' }
              ]}
              value={sleepQual}
              onChange={setSleepQual}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-alcohol">Alcohol Consumption</label>
            <CustomDropdown
              options={[
                { value: 'none', label: 'None' },
                { value: 'occasional', label: 'Occasional' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'heavy', label: 'Heavy' }
              ]}
              value={alcohol}
              onChange={setAlcohol}
            />
          </div>
          <div className="form-group">
            <label htmlFor="prof-tobacco">Tobacco Consumption</label>
            <CustomDropdown
              options={[
                { value: 'none', label: 'None / Never' },
                { value: 'past', label: 'Former Smoker' },
                { value: 'daily', label: 'Active User' }
              ]}
              value={tobacco}
              onChange={setTobacco}
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                id="prof-fam-cardio"
                checked={famCardioCheck}
                onChange={(e) => setFamCardioCheck(e.target.checked)}
              /> Family History (Heart Disease)
            </label>
            <label>
              <input 
                type="checkbox" 
                id="prof-fam-diabetes"
                checked={famDiabetesCheck}
                onChange={(e) => setFamDiabetesCheck(e.target.checked)}
              /> Family History (Diabetes)
            </label>
            <label>
              <input 
                type="checkbox" 
                id="prof-smoke"
                checked={smokeCheck}
                onChange={(e) => setSmokeCheck(e.target.checked)}
              /> Smoker (Yes/No)
            </label>
            <label>
              <input 
                type="checkbox" 
                id="prof-active"
                checked={activeCheck}
                onChange={(e) => setActiveCheck(e.target.checked)}
              /> Physically Active
            </label>
          </div>

          <div className="form-group full-width">
            <label htmlFor="prof-meds">Active Medications (comma separated)</label>
            <input 
              type="text" 
              id="prof-meds" 
              placeholder="e.g. Lisinopril, Metformin, Aspirin"
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label htmlFor="prof-allergies">Allergies (comma separated)</label>
            <input 
              type="text" 
              id="prof-allergies" 
              placeholder="e.g. Penicillin, Sulfa drugs"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label htmlFor="prof-history">Medical History / Chronic Illnesses (comma separated)</label>
            <input 
              type="text" 
              id="prof-history" 
              placeholder="e.g. Hypertension, Pre-diabetes"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label htmlFor="prof-operations">Past Operations / Surgeries (comma separated)</label>
            <input 
              type="text" 
              id="prof-operations" 
              placeholder="e.g. Appendectomy, Stent replacement"
              value={operations}
              onChange={(e) => setOperations(e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label htmlFor="prof-additional-notes">Additional Profile Notes / Conditions</label>
            <textarea 
              id="prof-additional-notes" 
              rows={3} 
              placeholder="Describe any other conditions, lifestyle comments, or custom notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary full-width">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Update intake profile
          </button>
        </form>
        {profileMsg.text && (
          <div className={`alert alert-${profileMsg.type}`} style={{ marginTop: '1rem', textAlign: 'center' }}>
            {profileMsg.text}
          </div>
        )}
      </div>

      {/* Calculated Clinical Risks */}
      <div className="card card-risks full-width-card">
        <div className="card-header">
          <h3>Determined Clinical Indicators</h3>
          <p>Calculated using safety parameters, active vitals, and profile details</p>
        </div>
        <div className="risk-indicators-grid">
          <div className={`indicator-card ${getRiskStatusClass(indicators?.blood_pressure_stage?.stage)}`} id="ind-bp">
            <div className="ind-icon">❤️</div>
            <h4>AHA Blood Pressure</h4>
            <div className="ind-val">{indicators?.blood_pressure_stage?.stage || 'No Data'}</div>
            <p className="ind-desc">Determined from logged Systolic/Diastolic BP.</p>
          </div>
          <div className={`indicator-card ${getRiskStatusClass(
            indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score !== null 
              ? `${indicators?.ascvd_risk?.score.toFixed(1)}%` 
              : 'N/A',
            indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score >= 15 ? 'danger' : indicators?.ascvd_risk?.score >= 7.5 ? 'elevated' : 'normal'
          )}`} id="ind-ascvd">
            <div className="ind-icon">⚡</div>
            <h4>10-Yr Cardiovascular Risk</h4>
            <div className="ind-val">
              {indicators?.ascvd_risk?.score !== undefined && indicators?.ascvd_risk?.score !== null
                ? `${indicators.ascvd_risk.score.toFixed(1)}%`
                : 'No Data'}
            </div>
            <p className="ind-desc">ASCVD Score (requires age, gender, BP, smoking history).</p>
          </div>
          <div className={`indicator-card ${getRiskStatusClass(indicators?.diabetes_risk?.category)}`} id="ind-diabetes">
            <div className="ind-icon">🩸</div>
            <h4>Diabetes Staging</h4>
            <div className="ind-val">{indicators?.diabetes_risk?.category || 'No Data'}</div>
            <p className="ind-desc">Calculated via FINDRISC parameters (age, BMI, sugar).</p>
          </div>
          <div className={`indicator-card ${getRiskStatusClass(indicators?.kidney_gfr?.stage)}`} id="ind-kidney">
            <div className="ind-icon">💧</div>
            <h4>GFR Kidney Function</h4>
            <div className="ind-val">{indicators?.kidney_gfr?.stage || 'No Data'}</div>
            <p className="ind-desc">CKD-EPI equation stage (requires creatinine, age, gender).</p>
          </div>
        </div>
      </div>

      {/* Vitals Timeline Graph */}
      <VitalsTimeline />

      {/* Emergency SOS Broadcast Card */}
      <div className="card card-emergency full-width-card" style={{ marginTop: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.01) 100%)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.8rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ color: '#ff4a4a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
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
          <div id="sos-status-container" style={{ marginTop: '1.2rem', padding: '1.2rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)' }}>
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
        )}
      </div>

      {/* OTP and Locator Grid */}
      <div className="grid-layout full-width-card" style={{ marginTop: '1.5rem', width: '100%', padding: 0 }}>
        {/* OTP Card */}
        <div className="card card-otp">
          <div className="card-header">
            <h3>Secure Clinician Access OTP</h3>
            <p>Generate a one-time 6-digit security code valid for 60 seconds to permit clinician updates</p>
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
        <div className="card card-locator">
          <div className="card-header">
            <h3>Emergency Hospital Locator</h3>
            <p>Privately find nearest health centers locally computed via great-circle distance formulas</p>
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
              {hospitalsLoading ? 'Searching...' : 'Find Nearby Hospital suggestions'}
            </button>

            {hospitalsError && (
              <div className="alert alert-danger" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                {hospitalsError}
              </div>
            )}

            <div id="hospitals-list" className="hospitals-list" style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {hospitals.map((h, i) => (
                <div key={i} className="hospital-item">
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
