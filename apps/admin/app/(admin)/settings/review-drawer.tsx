'use client';

import React from 'react';
import { ActionButtons } from '../action-buttons';

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  entityId: string;
  type: 'therapist' | 'practice';
}

export function ReviewDrawer({ isOpen, onClose, title, children, entityId, type }: ReviewDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="drawer-header__info">
            <div className="kicker">Reviewmodus</div>
            <h3>{title}</h3>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        
        <main className="drawer-body">
          {children}
        </main>

        <footer className="drawer-footer">
          <ActionButtons id={entityId} type={type} />
        </footer>
      </div>
    </div>
  );
}