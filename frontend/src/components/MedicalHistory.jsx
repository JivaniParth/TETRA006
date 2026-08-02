"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';

export default function MedicalHistory() {
  const { historyData, setCurrentSessionId } = useApp();
  const [filter, setFilter] = useState('all');
  const [chatSessions, setChatSessions] = useState([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await apiCall('/query/sessions');
      setChatSessions(data || []);
    } catch (e) {
      console.error('Failed to load chat sessions for history timeline', e);
    }
  };

  const getFilteredItems = () => {
    const items = [];

    // Parse Vitals Logs
    if (filter === 'all' || filter === 'vitals') {
      const vitals = historyData?.vitals || [];
      vitals.forEach(v => {
        const metrics = [];
        if (v.systolic_bp) metrics.push(`Blood Pressure: ${v.systolic_bp}/${v.diastolic_bp} mmHg`);
        if (v.blood_sugar) metrics.push(`Blood Sugar: ${v.blood_sugar} mg/dL (${v.blood_sugar_type || 'unclassified'})`);
        if (v.heart_rate) metrics.push(`Heart Rate: ${v.heart_rate} bpm`);
        if (v.creatinine) metrics.push(`Creatinine: ${v.creatinine} mg/dL`);

        items.push({
          id: 'v_' + (v.id || v.recorded_at),
          type: 'vitals',
          badge: 'vitals',
          time: new Date(v.recorded_at),
          body: metrics.join(' | ') || 'Vitals entry (no parameters set)'
        });
      });
    }

    // Parse Reports Logs
    if (filter === 'all' || filter === 'reports') {
      const reports = historyData?.reports || [];
      reports.forEach(r => {
        items.push({
          id: 'r_' + (r.id || r.created_at),
          type: 'reports',
          badge: 'reports',
          time: new Date(r.created_at),
          body: `Ingested File: ${r.file_name} (${r.status.toUpperCase()})\nCalculated Severity: ${r.severity_tier.toUpperCase()}\nExtracted parameters: ${JSON.stringify(r.extracted_values)}`
        });
      });
    }

    // Parse Queries / Inference Logs
    if (filter === 'all' || filter === 'queries') {
      const inferences = historyData?.inferences || [];
      inferences.forEach(inf => {
        items.push({
          id: 'q_' + (inf.id || inf.created_at),
          type: 'queries',
          badge: 'queries',
          time: new Date(inf.created_at),
          body: inf.text_content
        });
      });

      // Also include saved Chat Sessions
      chatSessions.forEach(cs => {
        items.push({
          id: 'cs_' + cs.session_id,
          type: 'chatsession',
          badge: 'chat session',
          time: new Date(cs.updated_at),
          sessionId: cs.session_id,
          body: `Consultation Session: ${cs.title}`
        });
      });
    }

    // Sort newest first
    items.sort((a, b) => b.time - a.time);
    return items;
  };

  const filteredItems = getFilteredItems();

  return (
    <div id="tab-history" className="tab-content history-pane">
      <div className="card">
        <div className="card-header">
          <h3>Patient Medical Records</h3>
          <p>Chronological overview of vitals logging, ingested reports, and saved AI chat consultations</p>
        </div>
        
        <div className="history-tabs">
          <button 
            onClick={() => setFilter('all')} 
            className={filter === 'all' ? 'history-tabactive' : 'history-tab'}
          >
            All Records
          </button>
          <button 
            onClick={() => setFilter('vitals')} 
            className={filter === 'vitals' ? 'history-tabactive' : 'history-tab'}
          >
            Vitals Entries
          </button>
          <button 
            onClick={() => setFilter('reports')} 
            className={filter === 'reports' ? 'history-tabactive' : 'history-tab'}
          >
            Reports Ingested
          </button>
          <button 
            onClick={() => setFilter('queries')} 
            className={filter === 'queries' ? 'history-tabactive' : 'history-tab'}
          >
            AI Conversations
          </button>
        </div>

        <div id="history-list" className="history-list">
          {filteredItems.length === 0 ? (
            <p className="empty-state">No historical entries found matching this filter.</p>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="history-item">
                <div className="hist-header">
                  <span className={`hist-badge badge-${item.type}`}>{item.badge}</span>
                  <span className="hist-time">{item.time.toLocaleString()}</span>
                </div>
                <div className="hist-body">
                  {item.body}
                  {item.sessionId && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <Link 
                        href="/chat" 
                        onClick={() => setCurrentSessionId(item.sessionId)}
                        className="btn-secondary btn-small"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.78rem' }}
                      >
                        💬 Resume Session
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
