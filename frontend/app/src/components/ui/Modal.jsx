import React from 'react';
import Button from './Button';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footerActions = null,
  maxWidth = 'max-w-md'
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Dialog */}
      <div className={`relative w-full ${maxWidth} mx-auto my-6 p-4 z-50`}>
        <div className="relative flex flex-col w-full bg-surface-container-lowest border border-border-subtle rounded-xl shadow-2xl outline-none">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border-subtle rounded-t">
            <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
              {title}
            </h3>
            <button
              className="p-1 ml-auto bg-transparent border-0 text-on-surface-variant hover:text-primary transition-colors outline-none focus:outline-none"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="relative p-6 flex-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
            {children}
          </div>

          {/* Footer */}
          {footerActions && (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border-subtle rounded-b">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
