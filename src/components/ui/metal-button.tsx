"use client";

import React from 'react';

interface MetalButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function MetalButton({ children, onClick, className = "", disabled = false }: MetalButtonProps) {
  return (
    <>
      <style>{`
        .metal-border-wrap {
          position: relative;
          padding: 3px;
          background: linear-gradient(
            90deg, 
            #ff0100, #fe7f01, #ffff00, #00fe00, #0000fe, #4a0183, #8a00ff, #ff0100
          );
          background-size: 200% 100%;
          animation: metal-prismatic-flow 4s linear infinite;
          border-radius: 64px;
          box-shadow: 
            0 15px 35px -10px rgba(0,0,0,0.2),
            0 5px 15px -5px rgba(0,0,0,0.1);
          display: inline-block;
        }

        .metal-border-wrap.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          animation-play-state: paused;
        }

        @keyframes metal-prismatic-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        .metal-skeuo-pill {
          background: linear-gradient(180deg, #FFFFFF 0%, #E2E2E2 100%);
          border-radius: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 40px;
          border: 1px solid rgba(255, 255, 255, 0.9);
          position: relative;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.2s ease;
          box-shadow: 
            0 12px 24px -4px rgba(0,0,0,0.12),
            0 4px 8px -2px rgba(0,0,0,0.08),
            inset 0 2px 1px rgba(255,255,255,1);
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .metal-skeuo-pill:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 
            0 18px 36px -8px rgba(0,0,0,0.15),
            0 6px 12px -3px rgba(0,0,0,0.1),
            inset 0 2px 1px rgba(255,255,255,1);
        }

        .metal-skeuo-pill:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.1),
            inset 0 2px 8px rgba(0,0,0,0.15);
        }

        .metal-skeuo-pill:disabled {
          cursor: not-allowed;
        }

        .metal-pill-text {
          color: #121212;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: -0.025em;
        }
      `}</style>

      <div className={`metal-border-wrap ${disabled ? 'disabled' : ''} ${className}`}>
        <button 
          className="metal-skeuo-pill"
          onClick={onClick}
          disabled={disabled}
        >
          <span className="metal-pill-text">{children}</span>
        </button>
      </div>
    </>
  );
}

export default MetalButton;
