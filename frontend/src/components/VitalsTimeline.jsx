"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const METRIC_GROUPS = [
  { id: 'clinical', label: 'Blood Pressure & Sugar' },
  { id: 'lifestyle', label: 'Weight, Hydration & Sleep' },
];

export default function VitalsTimeline() {
  const { timeline } = useApp();
  const [activeGroup, setActiveGroup] = useState('clinical');

  if (!timeline || timeline.length === 0) {
    return (
      <div className="card card-vitals-timeline full-width-card">
        <div className="card-header">
          <h3>Historical Vitals Timeline</h3>
          <p>Log your vitals to see interactive trend charts here.</p>
        </div>
        <p className="empty-state" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No historical vital records to graph yet. Please log your vitals to get started.
        </p>
      </div>
    );
  }

  const labels = timeline.map(t => {
    const d = new Date(t.recorded_at);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // --- Clinical datasets ---
  const clinicalDatasets = [
    {
      label: 'Systolic BP (mmHg)',
      data: timeline.map(t => t.systolic_bp),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
    {
      label: 'Diastolic BP (mmHg)',
      data: timeline.map(t => t.diastolic_bp),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
    {
      label: 'Blood Sugar (mg/dL)',
      data: timeline.map(t => t.blood_sugar),
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14,165,233,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
    {
      label: 'Heart Rate (bpm)',
      data: timeline.map(t => t.heart_rate),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
  ];

  // --- Lifestyle datasets ---
  const lifestyleDatasets = [
    {
      label: 'Weight (kg)',
      data: timeline.map(t => t.weight),
      borderColor: '#a78bfa',
      backgroundColor: 'rgba(167,139,250,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
    {
      label: 'Water Intake (mL)',
      data: timeline.map(t => t.water_intake_ml),
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
    {
      label: 'Sleep Hours',
      data: timeline.map(t => t.sleep_hours),
      borderColor: '#34d399',
      backgroundColor: 'rgba(52,211,153,0.06)',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      pointRadius: 3,
    },
  ];

  const activeDatasets = activeGroup === 'clinical' ? clinicalDatasets : lifestyleDatasets;

  const chartData = { labels, datasets: activeDatasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: {
        grid: { color: 'rgba(148,163,184,0.08)' },
        ticks: {
          color: 'rgba(148,163,184,0.9)',
          font: { family: 'Inter', size: 11 }
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: 'rgba(148,163,184,0.9)',
          font: { family: 'Inter', size: 10 },
          maxTicksLimit: 8,
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(148,163,184,0.9)',
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(51,65,85,0.8)',
        borderWidth: 1,
        padding: 10,
      }
    }
  };

  return (
    <div className="card card-vitals-timeline full-width-card">
      <div className="card-header" style={{ marginBottom: '0.8rem' }}>
        <h3>Historical Vitals Timeline</h3>
        <p>Interactive trends — switch between clinical vitals and lifestyle metrics</p>
      </div>

      {/* Metric Group Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.8rem' }}>
        {METRIC_GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            style={{
              background: activeGroup === g.id ? 'rgba(16,185,129,0.12)' : 'transparent',
              border: activeGroup === g.id ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
              color: activeGroup === g.id ? 'var(--color-primary)' : 'var(--text-muted)',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: activeGroup === g.id ? '700' : '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
