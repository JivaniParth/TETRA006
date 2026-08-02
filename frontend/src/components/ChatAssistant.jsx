"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall } from '../services/api';

export default function ChatAssistant() {
  const {
    chatMessages,
    setChatMessages,
    chatAlerts,
    setChatAlerts,
    currentSessionId,
    setCurrentSessionId,
    fetchIndicators,
    fetchHistory,
    showToast
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const [clarifyVal, setClarifyVal] = useState('');
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyText, setClarifyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Chat History Sessions list
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);

  // Fetch past chat sessions on mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await apiCall('/query/sessions');
      setSessionsList(data || []);
    } catch (err) {
      console.error('Failed to load chat history sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await apiCall(`/query/sessions/${sessionId}`);
      setCurrentSessionId(data.session_id);

      const formatted = (data.messages || []).map(m => ({
        id: m.id,
        sender: m.role === 'user' ? 'user' : 'assistant',
        text: m.content,
        htmlText: m.html_content
      }));

      if (formatted.length === 0) {
        setChatMessages([
          {
            id: 'init_msg',
            sender: 'assistant',
            text: `Opened session: ${data.title}`
          }
        ]);
      } else {
        setChatMessages(formatted);
      }

      setClarifyOpen(false);
      setChatAlerts([]);
      if (showToast) showToast(`Loaded session: ${data.title}`, 'success');
    } catch (err) {
      if (showToast) showToast(`Failed to load chat session: ${err.message}`, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await apiCall(`/query/sessions/${sessionId}`, { method: 'DELETE' });
      setSessionsList(prev => prev.filter(s => s.session_id !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewSession();
      }
      if (showToast) showToast('Chat session deleted.', 'warning');
    } catch (err) {
      if (showToast) showToast(`Failed to delete session: ${err.message}`, 'danger');
    }
  };

  // Adjust clarification panel state if loaded from cache
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.sender === 'assistant' && lastMsg.status === 'awaiting_user_input') {
        setClarifyText(lastMsg.text);
        setClarifyOpen(true);
      } else {
        setClarifyOpen(false);
      }
    } else {
      setClarifyOpen(false);
      // Populate greeting
      setChatMessages([
        {
          id: 'init_msg',
          sender: 'assistant',
          text: 'Hello! I am MedGuard, your clinical decision support assistant. You can describe any symptoms or ask medical questions. Please make sure your profile and vitals are logged for more personalized findings.'
        }
      ]);
    }
  }, [chatMessages]);

  const handleNewSession = () => {
    setChatMessages([
      {
        id: 'init_msg',
        sender: 'assistant',
        text: 'Started a fresh chat session. Describe your symptoms or ask a medical question.'
      }
    ]);
    setChatAlerts([]);
    setCurrentSessionId(null);
    setClarifyOpen(false);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userText = inputVal.trim();
    setInputVal('');

    // Append user message
    const userMsgId = 'msg_' + Math.random().toString(36).substring(2, 9);
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const payload = { text: userText };
      if (currentSessionId) {
        payload.session_id = currentSessionId;
      }

      const res = await apiCall('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      processQueryResponse(res, userText);
      loadChatSessions();
    } catch (err) {
      const errId = 'msg_err_' + Math.random().toString(36).substring(2, 9);
      setChatMessages(prev => [
        ...prev, 
        { id: errId, sender: 'assistant', text: `An error occurred: ${err.message}`, isOffline: true }
      ]);
      setIsLoading(false);
    }
  };

  const handleClarifySubmit = async (e) => {
    e.preventDefault();
    if (!clarifyVal.trim() || isLoading) return;

    const userText = clarifyVal.trim();
    setClarifyVal('');
    setClarifyOpen(false);

    // Append user message
    const userMsgId = 'msg_' + Math.random().toString(36).substring(2, 9);
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const payload = {
        text: userText,
        session_id: currentSessionId
      };

      const res = await apiCall('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      processQueryResponse(res, userText);
      loadChatSessions();
    } catch (err) {
      const errId = 'msg_err_' + Math.random().toString(36).substring(2, 9);
      setChatMessages(prev => [
        ...prev, 
        { id: errId, sender: 'assistant', text: `An error occurred: ${err.message}`, isOffline: true }
      ]);
      setIsLoading(false);
    }
  };

  const processQueryResponse = (res, userText) => {
    const aiMsgId = 'msg_' + Math.random().toString(36).substring(2, 9);
    
    if (res.status === 'awaiting_user_input') {
      setCurrentSessionId(res.session_id);
      setChatMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'assistant',
          text: res.response,
          htmlText: res.html_response,
          status: 'awaiting_user_input'
        }
      ]);
      setClarifyText(res.response);
      setClarifyOpen(true);
    } else {
      // Completed Dialog
      setCurrentSessionId(null);
      setChatMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'assistant',
          text: res.response,
          htmlText: res.html_response,
          status: 'complete'
        }
      ]);
      setClarifyOpen(false);

      // Refresh Indicators & History logs
      fetchIndicators();
      fetchHistory();
    }

    setChatAlerts(res.safety_alerts || []);
    setIsLoading(false);
  };

  const isDdiWarning = (alert) => {
    return alert.includes('INTERACTION') || alert.includes('ALLERGY');
  };

  return (
    <div id="tab-chat" className="tab-content chat-grid">
      {/* Main Chat pane */}
      <div className="card chat-card">
        <div className="chat-header-pane">
          <div className="agent-title">
            <span className="active-pulse"></span>
            <div>
              <strong>MedGuard AI Clinical Agent</strong>
              <span>Powered by MedGemma 4B</span>
            </div>
          </div>
          <button onClick={handleNewSession} className="btn-secondary btn-small">
            + New Session
          </button>
        </div>

        <div className="chat-messages">
          {chatMessages.map((msg) => {
            const isOffline = msg.isOffline || msg.text?.includes('disclaimer') || msg.text?.includes('Safety Checks');
            return (
              <div
                key={msg.id}
                className={`msg msg-${msg.sender} ${isOffline ? 'msg-assistant-offline' : ''}
              `}
              >
                {msg.htmlText ? (
                  <div dangerouslySetInnerHTML={{ __html: msg.htmlText }} />
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="msg msg-assistant">
              <p>Thinking...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Clarification panel */}
        {clarifyOpen && (
          <div id="clarify-panel" className="clarify-panel">
            <div className="clarify-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="warning-amber">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Missing Information Request:</span>
            </div>
            <p id="clarify-text">{clarifyText}</p>
            <form onSubmit={handleClarifySubmit} className="clarify-input-row">
              <input 
                type="text" 
                id="clarify-input" 
                placeholder="Your answer (e.g. since 2 hours)"
                value={clarifyVal}
                onChange={(e) => setClarifyVal(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="btn-primary">Submit Answer</button>
            </form>
          </div>
        )}

        {/* Standard input row */}
        {!clarifyOpen && (
          <form onSubmit={handleChatSubmit} className="chat-input-row">
            <input 
              type="text" 
              id="chat-input" 
              required 
              placeholder="Ask about symptoms, medications, or reports..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        )}

        <div className="disclaimer-text">
          Disclaimer: This is an AI system which may make mistakes. This analysis is for clinical decision support and does not constitute a formal diagnosis.
        </div>
      </div>

      {/* Sidebar: Chat History Sessions & Safety Alerts */}
      <div className="chat-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        
        {/* Chat History Sessions Card */}
        <div className="card sidebar-card" style={{ flex: 1, maxHeight: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-header" style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-main)', fontFamily: 'Outfit' }}>💬 Consultation History</h4>
            <button onClick={loadChatSessions} className="btn-secondary btn-small" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
              Refresh
            </button>
          </div>
          
          <div className="sessions-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.8rem' }}>
            {sessionsLoading ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Loading sessions...</div>
            ) : sessionsList.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No saved chat sessions.</div>
            ) : (
              sessionsList.map(s => {
                const isActive = currentSessionId === s.session_id;
                const formattedDate = new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={s.session_id}
                    onClick={() => handleSelectSession(s.session_id)}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--card-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, marginRight: '8px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, color: 'var(--text-main)' }}>{s.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formattedDate}</div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.session_id)}
                      title="Delete session"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '2px 4px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Safety Alerts Card */}
        <div className="card sidebar-card card-alerts" style={{ flex: 1 }}>
          <div className="card-header">
            <h4>Safety Alerts & Flags</h4>
          </div>
          <div id="chat-alerts-container" className="alerts-list">
            {chatAlerts.length === 0 ? (
              <div className="no-alerts">No safety flags triggered in this session.</div>
            ) : (
              chatAlerts.map((alert, i) => (
                <div key={i} className={`alert-banner ${isDdiWarning(alert) ? 'alert-ddi' : 'alert-escalation'}`}>
                  {isDdiWarning(alert) ? (
                    <>
                      <strong>⚠️ CRITICAL DRUG WARNING</strong>
                      <span>{alert}</span>
                    </>
                  ) : (
                    <>
                      <strong>⚡ CLINICAL ALERT</strong>
                      <span>{alert}</span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
