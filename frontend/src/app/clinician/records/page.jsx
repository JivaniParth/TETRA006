"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClinicianRecords from '../../../components/ClinicianRecords.jsx';
import { useApp } from '../../../context/AppContext.jsx';

export default function ClinicianRecordsPage() {
  const { token, role, isMounted } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isMounted) {
      if (!token) {
        router.push('/login');
      } else if (role !== 'clinician') {
        router.push('/dashboard');
      }
    }
  }, [token, role, isMounted]);

  if (!isMounted || !token || role !== 'clinician') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting to secure records portal...</p>
      </div>
    );
  }

  return <ClinicianRecords />;
}
