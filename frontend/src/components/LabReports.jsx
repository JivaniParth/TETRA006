"use client";

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall, compressFile } from '../services/api';

export default function LabReports() {
  const { fetchIndicators, fetchHistory } = useApp();
  
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ text: '', type: '' });
  
  // Verification card state
  const [showConfirm, setShowConfirm] = useState(false);
  const [reportId, setReportId] = useState('');
  const [fileName, setFileName] = useState('');
  const [confidence, setConfidence] = useState('0%');
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [sugar, setSugar] = useState('');
  const [hr, setHr] = useState('');
  const [creatinine, setCreatinine] = useState('');
  const [approveCheck, setApproveCheck] = useState(true);
  const [confirmMsg, setConfirmMsg] = useState({ text: '', type: '' });
  
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const uploadFile = async (file) => {
    setShowConfirm(false);
    setConfirmMsg({ text: '', type: '' });

    const isImage = file.type.startsWith('image/');
    const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const originalSizeKB = (file.size / 1024).toFixed(1);

    // Step 1: Compress if it's an image
    let fileToUpload = file;
    if (isImage) {
      setUploadStatus({ text: `Compressing "${file.name}" (${originalSizeKB} KB)...`, type: 'info' });
      fileToUpload = await compressFile(file);
      const newSizeKB = (fileToUpload.size / 1024).toFixed(1);
      const saved = Math.round(((file.size - fileToUpload.size) / file.size) * 100);
      if (fileToUpload.size < file.size) {
        setUploadStatus({ text: `Compressed ${originalSizeKB} KB → ${newSizeKB} KB (${saved}% saved). Uploading...`, type: 'info' });
      } else {
        setUploadStatus({ text: `File already optimised (${originalSizeKB} KB). Uploading...`, type: 'info' });
      }
    } else if (isPdf) {
      setUploadStatus({ text: `Uploading PDF "${file.name}" (${originalSizeKB} KB)...`, type: 'info' });
    } else {
      setUploadStatus({ text: `Uploading "${file.name}"...`, type: 'info' });
    }

    // Step 2: Upload
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await apiCall('/reports/upload', {
        method: 'POST',
        body: formData
      });

      setUploadStatus({ text: 'Extraction complete! Please review the values below.', type: 'success' });
      setReportId(res.report_id);
      setFileName(res.file_name);
      setConfidence(`${Math.round(res.confidence * 100)}%`);

      const vals = res.extracted_values || {};
      setSbp(vals.systolic_bp || '');
      setDbp(vals.diastolic_bp || '');
      setSugar(vals.blood_sugar || vals.glucose || '');
      setHr(vals.heart_rate || '');
      setCreatinine(vals.creatinine || '');

      setShowConfirm(true);
    } catch (err) {
      setUploadStatus({ text: `Upload failed: ${err.message}`, type: 'danger' });
    }
  };

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    setConfirmMsg({ text: '', type: '' });

    if (!approveCheck) {
      setConfirmMsg({ text: 'You must approve the accuracy of the values to verify.', type: 'danger' });
      return;
    }

    const corrected_values = {};
    if (sbp) corrected_values.systolic_bp = parseInt(sbp);
    if (dbp) corrected_values.diastolic_bp = parseInt(dbp);
    if (sugar) corrected_values.blood_sugar = parseFloat(sugar);
    if (hr) corrected_values.heart_rate = parseInt(hr);
    if (creatinine) corrected_values.creatinine = parseFloat(creatinine);

    try {
      await apiCall(`/reports/${reportId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          corrected_values
        })
      });

      setConfirmMsg({ text: 'Report successfully confirmed and clinical metrics saved!', type: 'success' });
      
      // Refresh cache details
      fetchIndicators();
      fetchHistory();

      setTimeout(() => {
        setShowConfirm(false);
        setUploadStatus({ text: '', type: '' });
      }, 2000);
    } catch (err) {
      setConfirmMsg({ text: err.message, type: 'danger' });
    }
  };

  return (
    <div id="tab-reports" className="tab-content reports-grid">
      {/* File Uploader */}
      <div className="card upload-card">
        <div className="card-header">
          <h3>Upload Health Reports</h3>
          <p>Upload lab results (PDF or Image) to extract clinical vitals metrics automatically</p>
        </div>
        <div 
          className={`drop-zone ${dragActive ? 'dragover' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drag & drop PDF or Image file here or <span>Browse files</span></p>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="application/pdf,image/*"
            onChange={handleFileChange}
          />
        </div>
        {uploadStatus.text && (
          <div className={`alert alert-${uploadStatus.type}`} style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            {uploadStatus.text}
          </div>
        )}
      </div>

      {/* Sample Document Guide */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card-header" style={{ marginBottom: '0.8rem' }}>
          <h3>Sample Lab Report Scanner</h3>
          <p>SwasthyaSetu automatically extracts blood pressure, glucose, and creatinine values from lab files</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
          <img 
            src="/lab_sample.svg" 
            alt="Sample Lab Report Scanning Guide" 
            style={{ width: '100%', maxWidth: '540px', height: 'auto', borderRadius: '10px', border: '1px solid #374151' }}
          />
        </div>
      </div>

      {/* Review & Confirm Extraction */}
      {showConfirm && (
        <div id="confirm-card" className="card confirm-card">
          <div className="card-header">
            <h3>Review Extracted Metrics</h3>
            <p>Please review and verify values extracted by MedGemma before saving</p>
          </div>
          <div className="info-meta">
            <div>Confidence: <strong>{confidence}</strong></div>
            <div>File Name: <span>{fileName}</span></div>
          </div>
          
          <form onSubmit={handleConfirmSubmit} className="form-grid">
            <div className="form-group">
              <label htmlFor="extr-sbp">Systolic BP (mmHg)</label>
              <input 
                type="number" 
                id="extr-sbp"
                value={sbp}
                onChange={(e) => setSbp(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="extr-dbp">Diastolic BP (mmHg)</label>
              <input 
                type="number" 
                id="extr-dbp"
                value={dbp}
                onChange={(e) => setDbp(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="extr-sugar">Blood Sugar (mg/dL)</label>
              <input 
                type="number" 
                step="0.1" 
                id="extr-sugar"
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="extr-hr">Heart Rate (bpm)</label>
              <input 
                type="number" 
                id="extr-hr"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="extr-creatinine">Creatinine (mg/dL)</label>
              <input 
                type="number" 
                step="0.01" 
                id="extr-creatinine"
                value={creatinine}
                onChange={(e) => setCreatinine(e.target.value)}
              />
            </div>

            <div className="form-group full-width checkbox-group">
              <label className="approve-label">
                <input 
                  type="checkbox" 
                  id="confirm-approve-check" 
                  checked={approveCheck}
                  onChange={(e) => setApproveCheck(e.target.checked)}
                /> Confirm extracted values (or corrections) are correct
              </label>
            </div>

            <button type="submit" className="btn-primary full-width">Verify & Save Report Metrics</button>
          </form>
          {confirmMsg.text && (
            <div className={`alert alert-${confirmMsg.type}`} style={{ marginTop: '1rem', textAlign: 'center' }}>
              {confirmMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
