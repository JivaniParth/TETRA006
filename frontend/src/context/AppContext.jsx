"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiCall } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Session States
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  // App Global Views
  const [activeTab, setActiveTab] = useState('tab-profile');

  // Cached Patient States
  const [profile, setProfile] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [historyData, setHistoryData] = useState({ vitals: [], reports: [], inferences: [] });
  const [timeline, setTimeline] = useState([]);
  
  // Chat States (Persisted in sessionStorage so switching tabs doesn't clear the chat)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatAlerts, setChatAlerts] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Emergency SOS State
  const [activeSos, setActiveSos] = useState(null);

  // Clinician States
  const [escalations, setEscalations] = useState([]);
  const [sosBeacons, setSosBeacons] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [retrievedPatient, setRetrievedPatient] = useState(null);

  // Load configuration from local storage on mount
  useEffect(() => {
    setIsMounted(true);
    const cachedToken = localStorage.getItem('medguard_token');
    const cachedRole = localStorage.getItem('medguard_role');
    const cachedUserId = localStorage.getItem('medguard_user_id');
    const cachedEmail = localStorage.getItem('medguard_email');

    if (cachedToken && cachedRole && cachedUserId) {
      setToken(cachedToken);
      setRole(cachedRole);
      setUserId(cachedUserId);
      setEmail(cachedEmail);
      
      // Load initial chat if cached in sessionStorage
      try {
        const cachedChat = sessionStorage.getItem('medguard_chat_messages');
        const cachedAlerts = sessionStorage.getItem('medguard_chat_alerts');
        const cachedSessId = sessionStorage.getItem('medguard_chat_session_id');
        if (cachedChat) setChatMessages(JSON.parse(cachedChat));
        if (cachedAlerts) setChatAlerts(JSON.parse(cachedAlerts));
        if (cachedSessId) setCurrentSessionId(cachedSessId);
      } catch (e) {
        console.warn("Failed to parse cached chat logs", e);
      }
    }
  }, []);

  // Sync Chat Logs to SessionStorage whenever they change
  useEffect(() => {
    if (chatMessages.length > 0) {
      sessionStorage.setItem('medguard_chat_messages', JSON.stringify(chatMessages));
    } else {
      sessionStorage.removeItem('medguard_chat_messages');
    }
  }, [chatMessages]);

  useEffect(() => {
    if (chatAlerts.length > 0) {
      sessionStorage.setItem('medguard_chat_alerts', JSON.stringify(chatAlerts));
    } else {
      sessionStorage.removeItem('medguard_chat_alerts');
    }
  }, [chatAlerts]);

  useEffect(() => {
    if (currentSessionId) {
      sessionStorage.setItem('medguard_chat_session_id', currentSessionId);
    } else {
      sessionStorage.removeItem('medguard_chat_session_id');
    }
  }, [currentSessionId]);

  // Auth Setters
  const saveSession = (access_token, user_role, user_id, user_email) => {
    setToken(access_token);
    setRole(user_role);
    setUserId(user_id);
    setEmail(user_email);

    localStorage.setItem('medguard_token', access_token);
    localStorage.setItem('medguard_role', user_role);
    localStorage.setItem('medguard_user_id', user_id);
    localStorage.setItem('medguard_email', user_email);
    
    // Clear old chat logs on fresh login
    setChatMessages([]);
    setChatAlerts([]);
    setCurrentSessionId(null);
    sessionStorage.clear();
  };

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setUserId(null);
    setEmail(null);
    setProfile(null);
    setIndicators(null);
    setHistoryData({ vitals: [], reports: [], inferences: [] });
    setTimeline([]);
    setChatMessages([]);
    setChatAlerts([]);
    setCurrentSessionId(null);
    setActiveSos(null);
    setEscalations([]);
    setSosBeacons([]);
    setSelectedHospital('');
    setRetrievedPatient(null);

    localStorage.clear();
    sessionStorage.clear();
  }, []);

  // ---------------- PATIENT DATA API CALLS ----------------
  const fetchProfile = async () => {
    if (!userId || role !== 'patient') return;
    try {
      const data = await apiCall(`/patient/${userId}/profile`, {}, logout);
      setProfile(data);
      return data;
    } catch (e) {
      console.log('Profile retrieval: none created yet or server offline.', e);
    }
  };

  const fetchIndicators = async () => {
    if (!userId || role !== 'patient') return;
    try {
      const data = await apiCall(`/patient/${userId}/indicators`, {}, logout);
      setIndicators(data);
      return data;
    } catch (e) {
      console.error('Failed to query clinical indicators', e);
    }
  };

  const fetchHistory = async () => {
    if (!userId || role !== 'patient') return;
    try {
      const data = await apiCall(`/patient/${userId}/history`, {}, logout);
      setHistoryData(data);
      return data;
    } catch (e) {
      console.error('Failed to query patient logs history', e);
    }
  };

  const fetchTimeline = async () => {
    if (!userId || role !== 'patient') return;
    try {
      const data = await apiCall(`/patient/${userId}/vitals/timeline`, {}, logout);
      // Sort chronologically
      data.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      setTimeline(data);
      return data;
    } catch (e) {
      console.error('Failed to query vital timeline', e);
    }
  };

  const checkActiveSos = async () => {
    if (!userId || role !== 'patient') return;
    try {
      const data = await apiCall(`/patient/${userId}/emergency/active`, {}, logout);
      setActiveSos(data || null);
      return data;
    } catch (e) {
      console.error('Failed to query active SOS status', e);
    }
  };

  // ---------------- CLINICIAN DATA API CALLS ----------------
  const fetchEscalations = async () => {
    if (role !== 'clinician') return;
    try {
      const data = await apiCall('/clinician/escalations', {}, logout);
      // Filter for pending triage logs
      const pending = data.filter(e => e.status === 'pending');
      setEscalations(pending);
      return pending;
    } catch (e) {
      console.error('Failed to retrieve clinician escalations', e);
    }
  };

  const fetchEmergencies = async () => {
    if (role !== 'clinician') return;
    try {
      let url = '/clinician/emergencies?radius_km=50';
      if (selectedHospital) {
        const parts = selectedHospital.split('|');
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          url += `&latitude=${lat}&longitude=${lon}`;
        }
      }
      const data = await apiCall(url, {}, logout);
      setSosBeacons(data || []);
      return data;
    } catch (e) {
      console.error('Failed to query emergency dispatch beacons list', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        token,
        role,
        userId,
        email,
        isMounted,
        activeTab,
        setActiveTab,
        
        // Cached Patient states
        profile,
        setProfile,
        indicators,
        setIndicators,
        historyData,
        setHistoryData,
        timeline,
        setTimeline,
        
        // Chat states
        chatMessages,
        setChatMessages,
        chatAlerts,
        setChatAlerts,
        currentSessionId,
        setCurrentSessionId,
        
        // SOS state
        activeSos,
        setActiveSos,
        
        // Clinician states
        escalations,
        setEscalations,
        sosBeacons,
        setSosBeacons,
        selectedHospital,
        setSelectedHospital,
        retrievedPatient,
        setRetrievedPatient,

        // Actions
        saveSession,
        logout,
        fetchProfile,
        fetchIndicators,
        fetchHistory,
        fetchTimeline,
        checkActiveSos,
        fetchEscalations,
        fetchEmergencies
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside an AppProvider context hierarchy.');
  }
  return context;
}
