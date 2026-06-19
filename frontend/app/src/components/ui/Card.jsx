import React from 'react';

export default function Card({ 
  children, 
  title = null, 
  subtitle = null, 
  actions = null,
  className = '',
  bodyClassName = ''
}) {
  return (
    <div className={`bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex justify-between items-start mb-4 gap-4 border-b border-border-subtle pb-3">
          <div>
            {title && <h3 className="font-title-lg text-title-lg text-on-surface font-bold">{title}</h3>}
            {subtitle && <p className="text-on-surface-variant font-label-md text-label-md mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}
