"use client";

import React from 'react';
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

export default function VitalsTimeline() {
  const { timeline } = useApp();

  if (!timeline || timeline.length === 0) {
    return (
      <div className="card card-vitals-timeline full-width-card">
        <div className="card-header">
          <h3>Historical Vitals Timeline Chart</h3>
          <p>Interactive graphical trends of blood pressure, blood sugar, and cardiac cycles over time</p>
        </div>
        <p className="empty-state" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No historical vital records to graph yet. Please log your vitals above.
        </p>
      </div>
    );
  }

  const labels = timeline.map(t => {
    const d = new Date(t.recorded_at);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const sbpData = timeline.map(t => t.systolic_bp);
  const dbpData = timeline.map(t => t.diastolic_bp);
  const sugarData = timeline.map(t => t.blood_sugar);
  const hrData = timeline.map(t => t.heart_rate);

  const data = {
    labels,
    datasets: [
      {
        label: 'Systolic BP (mmHg)',
        data: sbpData,
        borderColor: '#ff5252',
        backgroundColor: 'rgba(255, 82, 82, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        spanGaps: true
      },
      {
        label: 'Diastolic BP (mmHg)',
        data: dbpData,
        borderColor: '#ffeb3b',
        backgroundColor: 'rgba(255, 235, 59, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        spanGaps: true
      },
      {
        label: 'Blood Sugar (mg/dL)',
        data: sugarData,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        spanGaps: true
      },
      {
        label: 'Heart Rate (bpm)',
        data: hrData,
        borderColor: '#00e676',
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        spanGaps: true
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255,255,255,0.7)', font: { family: 'Inter' } }
      },
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.7)', font: { family: 'Inter' } }
      }
    },
    plugins: {
      legend: {
        labels: { color: 'rgba(255,255,255,0.8)', font: { family: 'Inter', size: 11 } }
      }
    }
  };

  return (
    <div className="card card-vitals-timeline full-width-card">
      <div className="card-header">
        <h3>Historical Vitals Timeline Chart</h3>
        <p>Interactive graphical trends of blood pressure, blood sugar, and cardiac cycles over time</p>
      </div>
      <div className="chart-container" style={{ position: 'relative', height: '320px', width: '100%', marginTop: '1rem' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
