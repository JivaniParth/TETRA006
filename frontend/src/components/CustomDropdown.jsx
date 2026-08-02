"use client";

import React, { useState, useRef, useEffect } from 'react';

export default function CustomDropdown({ options, value, onChange, placeholder = 'Select option', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div 
      ref={dropdownRef} 
      style={{ 
        position: 'relative', 
        width: '100%', 
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
      }}
    >
      {/* Dropdown Header Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: isOpen ? '1px solid var(--color-primary)' : '1px solid var(--card-border)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'var(--transition)',
          boxShadow: isOpen ? '0 0 10px rgba(16, 185, 129, 0.15)' : 'none'
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        
        {/* Chevron Icon */}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            color: 'var(--text-muted)'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Options Overlay Panel */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            background: 'var(--card-bg)',
            backdropFilter: 'var(--blur)',
            WebkitBackdropFilter: 'var(--blur)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            maxHeight: '260px',
            overflowY: 'auto',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center' }}>
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.92rem',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-main)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.target.style.color = 'var(--color-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.target.style.background = 'transparent';
                      e.target.style.color = 'var(--text-main)';
                    }
                  }}
                >
                  {opt.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
