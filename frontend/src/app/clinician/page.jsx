"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClinicianDashboard from '../../components/ClinicianDashboard.jsx';
import { useApp } from '../../context/AppContext.jsx';

export default function ClinicianPage() {
  const { token, role, isMounted, fetchEscalations, fetchEmergencies } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isMounted) {
      if (!token) {
        router.push('/login');
      } else if (role !== 'clinician') {
        router.push('/dashboard');
      } else {
        fetchEscalations();
        fetchEmergencies();
      }
    }
  }, [token, role, isMounted]);

  if (!isMounted || !token || role !== 'clinician') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting to secure clinical portal...</p>
      </div>
    );
  }

  return <ClinicianDashboard />;
}
