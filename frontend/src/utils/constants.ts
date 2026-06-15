// Water quality thresholds
export const THRESHOLDS = {
  ph: { min: 6.5, max: 8.5, critical_min: 5.0, critical_max: 9.5, unit: '' },
  tds: { max: 500, critical_max: 1000, unit: 'ppm' },
  turbidity: { max: 5, critical_max: 10, unit: 'NTU' },
  temperature: { min: 10, max: 35, critical_min: 5, critical_max: 45, unit: '°C' },
  flow_rate: { min: 0, max: 1000, unit: 'L/min' },
} as const

// Quality score thresholds
export const QUALITY = {
  GOOD: 80,
  WARNING: 60,
  CRITICAL: 40,
  EMERGENCY: 20,
} as const

// Quality score colors
export const QUALITY_COLORS = {
  good: '#10B981',
  warning: '#F59E0B',
  critical: '#F97316',
  emergency: '#EF4444',
} as const

// Severity colors
export const SEVERITY_COLORS = {
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#D97706' },
  critical: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#EA580C' },
  emergency: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#DC2626' },
} as const

// Metric display config
export const METRIC_CONFIG = {
  ph: { label: 'pH Level', icon: '🧪', color: '#0070F3', format: (v: number) => v.toFixed(1) },
  tds: { label: 'TDS', icon: '💧', color: '#00B4D8', format: (v: number) => `${Math.round(v)} ppm` },
  turbidity: { label: 'Turbidity', icon: '🌊', color: '#00897B', format: (v: number) => `${v.toFixed(1)} NTU` },
  temperature: { label: 'Temperature', icon: '🌡️', color: '#F59E0B', format: (v: number) => `${v.toFixed(1)}°C` },
  flow_rate: { label: 'Flow Rate', icon: '🚿', color: '#8B5CF6', format: (v: number) => `${v.toFixed(1)} L/min` },
  quality_score: { label: 'Quality Score', icon: '⚡', color: '#10B981', format: (v: number) => `${Math.round(v)}` },
} as const

// Polling intervals (ms)
export const POLL_INTERVALS = {
  devices: 15_000,
  alerts: 15_000,
  anomalies: 30_000,
  status: 30_000,
  sensorData: 10_000,
} as const

// API base URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/updates'
