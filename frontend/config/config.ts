// Configuration for API endpoints and WebSocket
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const WEBSOCKET_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',
  RECONNECT_INTERVAL: 5000,
  RECONNECT_ATTEMPTS: 5,
  HEARTBEAT_INTERVAL: 30000,
};

export const POLLING_CONFIG = {
  DEVICE_LIST_INTERVAL: 30000, // 30 seconds
  DEVICE_READINGS_INTERVAL: 5000, // 5 seconds
  ALERTS_INTERVAL: 10000, // 10 seconds
};

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/health',

  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',

  // Devices
  DEVICES: '/devices',
  DEVICE_DETAIL: (id: string) => `/devices/${id}`,
  DEVICE_METRICS: (id: string) => `/devices/${id}/metrics`,

  // Sensor Data
  SENSOR_DATA: '/data',
  SENSOR_DATA_RANGE: (deviceId: string, startDate: string, endDate: string) => 
    `/data/${deviceId}?start=${startDate}&end=${endDate}`,

  // Alerts
  ALERTS: '/alerts',
  ALERT_ACKNOWLEDGE: (id: number) => `/alerts/${id}/acknowledge`,

  // Quality Scores
  QUALITY_SCORE: (deviceId: string) => `/quality-score/${deviceId}`,
  
  // Predictions (ML)
  PREDICT: '/predict',
};
