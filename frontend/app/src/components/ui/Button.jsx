import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  className = '', 
  disabled = false,
  loading = false,
  icon = null
}) {
  const baseStyle = "inline-flex items-center justify-center gap-2 font-bold rounded shadow-sm transition-all duration-150 ease-in-out select-none focus:outline-none focus:ring-2 focus:ring-primary/50";
  
  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary/95 hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none py-2 px-4",
    secondary: "bg-surface-container-low text-on-surface hover:bg-surface-container-high active:scale-95 disabled:opacity-50 disabled:pointer-events-none py-2 px-4 border border-border-subtle",
    premium: "btn-premium bg-primary text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-50 py-2.5 px-5",
    critical: "bg-status-critical/10 text-status-critical hover:bg-status-critical/20 active:scale-95 py-2 px-4",
    text: "text-primary hover:text-primary/80 bg-transparent shadow-none border-none py-1.5 px-3"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
