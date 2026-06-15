// Utility functions for the frontend
import { SensorReading, Alert, AlertSeverity, DeviceMetrics } from '@/types';
import { format, formatDistance } from 'date-fns';

// Date formatting
export const formatTimestamp = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
  } catch {
    return 'Invalid date';
  }
};

export const formatTimeAgo = (timestamp: string): string => {
  try {
    return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

// Sensor value formatting
export const formatPhValue = (ph: number): string => {
  return ph.toFixed(2);
};

export const formatTurbidity = (turbidity: number): string => {
  return turbidity.toFixed(2) + ' NTU';
};

export const formatTds = (tds: number): string => {
  return tds.toFixed(0) + ' ppm';
};

export const formatTemperature = (temp: number): string => {
  return temp.toFixed(1) + '°C';
};

export const formatFlowRate = (flowRate: number): string => {
  return flowRate.toFixed(2) + ' L/min';
};

// Quality score color coding
export const getQualityColor = (score: number): string => {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#f59e0b'; // amber
  if (score >= 40) return '#ef4444'; // red
  return '#7f1d1d'; // dark red
};

export const getQualityLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Poor';
  return 'Critical';
};

// Alert severity colors
export const getSeverityColor = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'emergency':
      return '#dc2626'; // red
    case 'critical':
      return '#f97316'; // orange
    case 'warning':
      return '#eab308'; // yellow
    default:
      return '#6b7280'; // gray
  }
};

export const getSeverityBadgeClass = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'emergency':
      return 'bg-red-100 text-red-800';
    case 'critical':
      return 'bg-orange-100 text-orange-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Status indicators
export const getStatusColor = (status: 'online' | 'offline'): string => {
  return status === 'online' ? '#10b981' : '#ef4444';
};

// Range checking
export const isPhInRange = (ph: number): boolean => {
  return ph >= 6.5 && ph <= 8.5;
};

export const isTurbidityInRange = (turbidity: number): boolean => {
  return turbidity <= 5;
};

export const isTdsInRange = (tds: number): boolean => {
  return tds <= 500;
};

export const isTemperatureInRange = (temp: number): boolean => {
  return temp >= 0 && temp <= 45;
};

// Trend calculation
export const calculateTrend = (
  current: number,
  previous: number
): 'up' | 'down' | 'stable' => {
  const difference = current - previous;
  const percentChange = (difference / previous) * 100;

  if (percentChange > 2) return 'up';
  if (percentChange < -2) return 'down';
  return 'stable';
};

// CSV export utility
export const exportReadingsToCSV = (
  readings: SensorReading[],
  deviceId: string
): void => {
  const headers = [
    'Timestamp',
    'pH',
    'Turbidity (NTU)',
    'TDS (ppm)',
    'Temperature (°C)',
    'Flow Rate (L/min)',
    'Quality Score',
  ];

  const csvContent = [
    headers.join(','),
    ...readings.map((r) =>
      [
        r.timestamp,
        r.ph.toFixed(2),
        r.turbidity.toFixed(2),
        r.tds.toFixed(0),
        r.temperature.toFixed(1),
        r.flow_rate.toFixed(2),
        r.quality_score.toFixed(0),
      ].join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `readings-${deviceId}-${Date.now()}.csv`;
  link.click();
};
