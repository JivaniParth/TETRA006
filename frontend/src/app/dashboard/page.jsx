"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PatientDashboard from '../../components/PatientDashboard.jsx';
import { useApp } from '../../context/AppContext.jsx';

export default function DashboardPage() {
  const { token, role, isMounted, fetchIndicators, fetchTimeline, checkActiveSos } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isMounted) {
      if (!token) {
        router.push('/login');
      } else if (role !== 'patient') {
        router.push('/clinician');
      } else {
        fetchIndicators();
        fetchTimeline();
        checkActiveSos();
      }
    }
  }, [token, role, isMounted]);

  if (!isMounted || !token || role !== 'patient') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting to secure dashboard...</p>
      </div>
    );
  }

  return <PatientDashboard />;
}
