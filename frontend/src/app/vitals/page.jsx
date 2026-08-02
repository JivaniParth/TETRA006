"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PatientVitalsForm from '../../components/PatientVitalsForm.jsx';
import { useApp } from '../../context/AppContext.jsx';

export default function VitalsPage() {
  const { token, role, isMounted } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isMounted) {
      if (!token) {
        router.push('/login');
      } else if (role !== 'patient') {
        router.push('/clinician');
      }
    }
  }, [token, role, isMounted]);

  if (!isMounted || !token || role !== 'patient') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting to secure portal...</p>
      </div>
    );
  }

  return <PatientVitalsForm />;
}
