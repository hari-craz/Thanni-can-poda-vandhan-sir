// Alert types
export interface Alert {
  id: number;
  device_id: string;
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgement_message?: string;
  is_acknowledged: boolean;
  status: 'unacknowledged' | 'acknowledged' | 'resolved';
}

export interface Anomaly {
  id: number;
  device_id: string;
  type: 'out_of_range' | 'stuck_sensor' | 'statistical_outlier';
  reading_id: number;
  detected_at: string;
  details: Record<string, any>;
}

export type AlertSeverity = 'warning' | 'critical' | 'emergency';
export type AlertStatus = 'unacknowledged' | 'acknowledged' | 'resolved';
