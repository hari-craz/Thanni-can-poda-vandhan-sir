import React from 'react';

export default function Badge({ 
  children, 
  variant = 'info', 
  className = '',
  pulse = false
}) {
  const baseStyle = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm uppercase select-none";
  
  const variants = {
    nominal: "bg-status-nominal/10 text-status-nominal",
    warning: "bg-status-warning/10 text-status-warning",
    critical: "bg-status-critical/10 text-status-critical",
    online: "bg-status-nominal/10 text-status-nominal",
    offline: "bg-surface-container-high text-on-surface-variant opacity-70",
    info: "bg-primary/10 text-primary-fixed",
  };

  const dotColors = {
    nominal: "bg-status-nominal",
    warning: "bg-status-warning",
    critical: "bg-status-critical",
    online: "bg-status-nominal",
    offline: "bg-on-surface-variant",
    info: "bg-primary",
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`}></span>
      {children}
    </span>
  );
}
