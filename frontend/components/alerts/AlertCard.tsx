'use client';

import React from 'react';

interface AlertCardProps {
  severity: 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  timestamp: string;
  acknowledged?: boolean;
}

const severityStyles = {
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  critical: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-800',
  },
  emergency: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
  },
};

export const AlertCard: React.FC<AlertCardProps> = ({
  severity,
  title,
  message,
  timestamp,
  acknowledged = false,
}) => {
  const styles = severityStyles[severity];
  const icons = { warning: '⚠️', critical: '🔴', emergency: '🚨' };

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 mb-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl mt-1">{icons[severity]}</span>
          <div>
            <h3 className={`font-semibold ${styles.text}`}>{title}</h3>
            <p className={`text-sm ${styles.text} mt-1`}>{message}</p>
            <p className="text-xs text-gray-600 mt-2">{timestamp}</p>
          </div>
        </div>
        {acknowledged && (
          <span className={`px-2 py-1 text-xs font-medium rounded ${styles.badge}`}>
            Acknowledged
          </span>
        )}
      </div>
    </div>
  );
};
