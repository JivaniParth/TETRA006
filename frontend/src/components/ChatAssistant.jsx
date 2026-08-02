"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiCall, apiCallBlob } from '../services/api';

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
  const [slowQueryBanner, setSlowQueryBanner] = useState(false);
  const slowQueryTimerRef = useRef(null);
  
  // Voice Mode & Speech States
  const [isListening, setIsListening] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [ttsLoadingId, setTtsLoadingId] = useState(null);

  // Chat History Sessions list
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);

  // 60-second slow-query banner
  useEffect(() => {
    if (isLoading) {
      slowQueryTimerRef.current = setTimeout(() => {
        setSlowQueryBanner(true);
      }, 60000);
    } else {
      clearTimeout(slowQueryTimerRef.current);
      setSlowQueryBanner(false);
    }
    return () => clearTimeout(slowQueryTimerRef.current);
  }, [isLoading]);

  // Fetch past chat sessions on mount
  useEffect(() => {
    loadChatSessions();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (audioRef.current) audioRef.current.pause();
      clearTimeout(slowQueryTimerRef.current);
    };
  }, []);

  // Initialize Web Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (showToast) showToast('Speech Recognition is not supported by your browser. Please try Chrome, Edge, or Safari.', 'warning');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        if (clarifyOpen) {
          setClarifyVal(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
        } else {
          setInputVal(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'no-speech' && showToast) {
        showToast(`Mic Error: ${event.error}`, 'danger');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  };

  const toggleMicListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          if (showToast) showToast('Listening... Speak now into your microphone.', 'success');
        } catch (e) {
          console.error('Failed to start speech recognition:', e);
        }
      }
    }
  };

  // Text-To-Speech (TTS) using backend ElevenLabs API with SpeechSynthesis fallback
  const handleReadAloud = async (msgId, textContent) => {
    // If already playing this message, stop it
    if (playingAudioId === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingAudioId(null);
      return;
    }

    // Strip HTML tags for clean spoken output
    const cleanText = textContent.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText) return;

    setTtsLoadingId(msgId);

    try {
      // Try ElevenLabs backend TTS first
      const audioBlob = await apiCallBlob('/query/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText })
      });

      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingAudioId(msgId);

      audio.onended = () => {
        setPlayingAudioId(null);
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        fallbackSpeechSynthesis(msgId, cleanText);
      };

      await audio.play();
    } catch (err) {
      console.warn('ElevenLabs TTS unavailable, falling back to browser SpeechSynthesis:', err.message);
      fallbackSpeechSynthesis(msgId, cleanText);
    } finally {
      setTtsLoadingId(null);
    }
  };

  const fallbackSpeechSynthesis = (msgId, text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => setPlayingAudioId(null);
      utterance.onerror = () => setPlayingAudioId(null);

      setPlayingAudioId(msgId);
      window.speechSynthesis.speak(utterance);
    } else {
      if (showToast) showToast('Text to Speech is not supported on this browser.', 'warning');
    }
  };

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
          text: 'Hello! I am SwasthyaSetu, your clinical decision support assistant. You can describe any symptoms or ask medical questions. Please make sure your profile and vitals are logged for more personalized findings.'
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

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

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

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

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
          detectedLanguage: res.detected_language,
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
          detectedLanguage: res.detected_language,
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

    // Auto Read Aloud if Voice Mode is active
    if (voiceModeActive && res.response) {
      handleReadAloud(aiMsgId, res.response);
    }
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
              <strong>SwasthyaSetu AI Clinical Agent</strong>
              <span>Powered by MedGemma 4B</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button
              onClick={() => {
                const nextState = !voiceModeActive;
                setVoiceModeActive(nextState);
                if (showToast) {
                  showToast(nextState ? 'Voice Mode Activated 🎙️' : 'Voice Mode Deactivated', nextState ? 'success' : 'warning');
                }
              }}
              className={`btn-secondary btn-small ${voiceModeActive ? 'active' : ''}`}
              style={{
                background: voiceModeActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                borderColor: voiceModeActive ? 'var(--color-primary)' : 'var(--card-border)',
                color: voiceModeActive ? 'var(--color-primary)' : 'var(--text-muted)'
              }}
            >
              🎙️ Voice Mode {voiceModeActive ? 'ON' : 'OFF'}
            </button>
            <button onClick={handleNewSession} className="btn-secondary btn-small">
              + New Session
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {chatMessages.map((msg) => {
            const isOffline = msg.isOffline || msg.text?.includes('disclaimer') || msg.text?.includes('Safety Checks');
            const isAssistant = msg.sender === 'assistant';
            const isPlaying = playingAudioId === msg.id;
            const isTtsLoading = ttsLoadingId === msg.id;

            return (
              <div
                key={msg.id}
                className={`msg msg-${msg.sender} ${isOffline ? 'msg-assistant-offline' : ''}`}
                style={{ position: 'relative' }}
              >
                {msg.detectedLanguage && msg.detectedLanguage !== 'en' && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 500
                    }}>
                      🌐 Auto-Translated ({msg.detectedLanguage.toUpperCase()})
                    </span>
                  </div>
                )}
                {msg.htmlText ? (
                  <div dangerouslySetInnerHTML={{ __html: msg.htmlText }} />
                ) : (
                  <p>{msg.text}</p>
                )}

                {/* Read Aloud Button for Assistant Messages */}
                {isAssistant && (
                  <div style={{ marginTop: '0.4rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleReadAloud(msg.id, msg.text || msg.htmlText || '')}
                      title="Read aloud via Text to Speech"
                      disabled={isTtsLoading}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '6px',
                        color: isPlaying ? 'var(--color-primary)' : 'var(--text-muted)',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isTtsLoading ? '⏳ Loading Speech...' : isPlaying ? '🔊 Playing...' : '🔊 Read Aloud'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="msg msg-assistant">
              <p>Thinking...</p>
            </div>
          )}

          {/* Slow-query timeout banner — shown after 60 s */}
          {slowQueryBanner && (
            <div style={{
              margin: '0.5rem 0',
              padding: '0.75rem 1.1rem',
              borderRadius: '8px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.7rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                <strong style={{ color: '#f59e0b' }}>Processing clinical query…</strong><br />
                This is taking a moment — the AI model is still working on your request.
                Your response will be saved to the <strong>Chat History</strong> drawer automatically as soon as it is ready.
                You can browse other sections of the app in the meantime.
              </span>
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
              <button
                type="button"
                onClick={toggleMicListening}
                className={`btn-secondary ${isListening ? 'active' : ''}`}
                style={{
                  background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  borderColor: isListening ? '#ef4444' : 'var(--card-border)',
                  color: isListening ? '#ef4444' : 'var(--text-main)'
                }}
                title={isListening ? 'Stop listening' : 'Start mic'}
              >
                {isListening ? '🔴 Rec' : '🎤'}
              </button>
              <input 
                type="text" 
                id="clarify-input" 
                placeholder={isListening ? "Listening... Speak your answer" : "Your answer (e.g. since 2 hours)"}
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
            <button
              type="button"
              onClick={toggleMicListening}
              className={`btn-secondary ${isListening ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: isListening ? '#ef4444' : 'var(--card-border)',
                color: isListening ? '#ef4444' : 'var(--text-main)',
                boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none'
              }}
              title={isListening ? 'Stop listening' : 'Start mic input'}
            >
              {isListening ? '🔴' : '🎤'}
            </button>

            <input 
              type="text" 
              id="chat-input" 
              required 
              placeholder={isListening ? "Listening... Speak now..." : "Ask about symptoms, medications, or reports..."}
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
