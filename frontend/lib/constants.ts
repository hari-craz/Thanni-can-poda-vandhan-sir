// Environment variables and constants
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',
};

// Feature flags
export const FEATURES = {
  ENABLE_WEBSOCKET: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET !== 'false',
  ENABLE_MQTT: process.env.NEXT_PUBLIC_ENABLE_MQTT !== 'false',
  ENABLE_ML_PREDICTIONS: process.env.NEXT_PUBLIC_ENABLE_ML !== 'false',
  ENABLE_DARK_MODE: process.env.NEXT_PUBLIC_ENABLE_DARK_MODE !== 'false',
};

// Logging utilities
export const log = {
  info: (message: string, data?: any) => {
    if (ENV.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, data);
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  },
  debug: (message: string, data?: any) => {
    if (ENV.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
};

// Sensor thresholds (matching backend config)
export const SENSOR_THRESHOLDS = {
  PH: {
    MIN: 6.5,
    MAX: 8.5,
  },
  TURBIDITY: {
    MIN: 0,
    MAX: 5,
  },
  TDS: {
    MIN: 0,
    MAX: 500,
  },
  TEMPERATURE: {
    MIN: 0,
    MAX: 45,
  },
  FLOW_RATE: {
    MIN: 0,
    MAX: 100,
  },
};

// Quality score thresholds
export const QUALITY_SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  POOR: 40,
  CRITICAL: 0,
};
