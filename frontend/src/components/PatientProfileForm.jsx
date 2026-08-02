"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';
import CustomDropdown from './CustomDropdown.jsx';

export default function PatientProfileForm() {
  const { profile, setProfile, fetchProfile, fetchIndicators, showToast } = useApp();

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
  const [isLoading, setIsLoading] = useState(false);

  // Sync with AppContext profile data on mount or change
  useEffect(() => {
    fetchProfile();
  }, []);

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

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });

    if (!age || age.toString().trim() === '') {
      showToast('Please fill out your Age', 'danger');
      return;
    }
    if (!height || height.toString().trim() === '') {
      showToast('Please fill out your Height', 'danger');
      return;
    }
    if (!weight || weight.toString().trim() === '') {
      showToast('Please fill out your Weight', 'danger');
      return;
    }

    setIsLoading(true);

    const medsArray = meds ? meds.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allergiesArray = allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [];
    const historyArray = history ? history.split(',').map(s => s.trim()).filter(Boolean) : [];
    const opsArray = operations ? operations.split(',').map(s => s.trim()).filter(Boolean) : [];

    const payload = {
      age: age ? parseInt(age) : null,
      gender: gender || null,
      height: height ? parseFloat(height) : null,
      weight: weight ? parseFloat(weight) : null,
      race: race || null,
      sleep_duration: sleepDur ? parseFloat(sleepDur) : null,
      sleep_quality: sleepQual || null,
      alcohol_consumption: alcohol || null,
      tobacco_consumption: tobacco || null,
      lifestyle_smoke: smokeCheck,
      lifestyle_active: activeCheck,
      family_history_cardiovascular: famCardioCheck,
      family_history_diabetes: famDiabetesCheck,
      active_medications: medsArray,
      allergies: allergiesArray,
      medical_history: historyArray,
      past_operations: opsArray,
      additional_notes: notes || null
    };

    try {
      const data = await apiCall('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setProfile(data);
      setProfileMsg({ text: 'Baseline intake profile successfully updated!', type: 'success' });
      fetchIndicators();
    } catch (err) {
      setProfileMsg({ text: err.message || 'Failed to update profile.', type: 'danger' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>Your Health Profile</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Keep your chronic baselines, surgical history, active drugs, and sleep parameters updated to refine safety triggers</p>
      </div>

      <div className="card card-profile" style={{ width: '100%' }}>
        <div className="card-header">
          <h3>Intake Profile & Medical History Form</h3>
          <p>Please enter details accurately. All data is securely calculated locally.</p>
        </div>

        <form onSubmit={handleProfileSubmit} noValidate className="form-grid" style={{ marginTop: '1.5rem' }}>
          
          <div className="form-group">
            <label htmlFor="prof-age">Age (Years)</label>
            <input 
              type="number" 
              id="prof-age" 
              required 
              min="0" 
              max="120" 
              placeholder="e.g. 45"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prof-height">Height (cm)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-height" 
              required 
              placeholder="e.g. 175"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prof-weight">Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-weight" 
              required 
              placeholder="e.g. 70"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={isLoading}
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
              placeholder="Select Race"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prof-sleep-dur">Sleep Duration (Hours)</label>
            <input 
              type="number" 
              step="0.1" 
              id="prof-sleep-dur" 
              placeholder="e.g. 7.5"
              value={sleepDur}
              onChange={(e) => setSleepDur(e.target.value)}
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prof-alcohol">Alcohol Intake</label>
            <CustomDropdown
              options={[
                { value: 'none', label: 'None' },
                { value: 'occasional', label: 'Occasional' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'heavy', label: 'Heavy' }
              ]}
              value={alcohol}
              onChange={setAlcohol}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="prof-tobacco">Tobacco Use</label>
            <CustomDropdown
              options={[
                { value: 'none', label: 'None / Never' },
                { value: 'past', label: 'Former Smoker' },
                { value: 'daily', label: 'Active User' }
              ]}
              value={tobacco}
              onChange={setTobacco}
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group checkbox-group" style={{ gridColumn: 'span 2', display: 'flex', gap: '1.2rem', margin: '0.5rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
              <input 
                type="checkbox" 
                checked={famCardioCheck}
                onChange={(e) => setFamCardioCheck(e.target.checked)}
                disabled={isLoading}
              /> Family History of Heart Illness
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
              <input 
                type="checkbox" 
                checked={famDiabetesCheck}
                onChange={(e) => setFamDiabetesCheck(e.target.checked)}
                disabled={isLoading}
              /> Family History of Diabetes
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
              <input 
                type="checkbox" 
                checked={smokeCheck}
                onChange={(e) => setSmokeCheck(e.target.checked)}
                disabled={isLoading}
              /> Active Smoker
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
              <input 
                type="checkbox" 
                checked={activeCheck}
                onChange={(e) => setActiveCheck(e.target.checked)}
                disabled={isLoading}
              /> Physically Active Lifestyle
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="prof-history">Chronic Conditions / History (comma separated)</label>
            <input 
              type="text" 
              id="prof-history" 
              placeholder="e.g. Hypertension, Pre-diabetes"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="prof-notes">Additional Baseline Notes</label>
            <textarea 
              id="prof-notes" 
              rows={3} 
              placeholder="Any other comments or details about your health profile..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn-primary full-width" style={{ gridColumn: 'span 2', height: '48px', fontWeight: '700', marginTop: '1rem' }} disabled={isLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            {isLoading ? 'Saving Baseline...' : 'Update Baseline Profile'}
          </button>

        </form>

        {profileMsg.text && (
          <div className={`alert alert-${profileMsg.type}`} style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            {profileMsg.text}
          </div>
        )}
      </div>

    </div>
  );
}
