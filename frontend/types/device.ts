// Device types
export interface Device {
  device_id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  firmware_version?: string;
  last_heartbeat_timestamp?: string;
  signal_strength?: number;
  created_at?: string;
  is_active?: boolean;
}

export interface SensorReading {
  id: number;
  device_id: string;
  ph: number;
  turbidity: number;
  tds: number;
  temperature: number;
  flow_rate: number;
  timestamp: string;
  received_at: string;
  quality_score: number;
  anomaly_flags?: Record<string, any>;
}

export interface DeviceMetrics {
  device_id: string;
  latest_ph: number;
  latest_turbidity: number;
  latest_tds: number;
  latest_temperature: number;
  latest_flow_rate: number;
  quality_score: number;
  last_updated: string;
  status: 'online' | 'offline';
}

export interface CalibrationStatus {
  device_id: string;
  last_calibrated?: string;
  next_calibration_due?: string;
  is_overdue: boolean;
}
