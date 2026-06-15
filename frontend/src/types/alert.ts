export type AlertSeverity = 'warning' | 'critical' | 'emergency'

export interface Alert {
  id: number
  device_id: string
  severity: AlertSeverity
  message: string
  triggered_at: string
  reading_timestamp: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
  minutes_unacknowledged: number | null
  acknowledgement_message: string | null
}

export interface AlertsListResponse {
  alerts: Alert[]
  total: number
}

export interface AlertAcknowledgeRequest {
  user_id: string
  acknowledgement_message?: string
}

export interface Anomaly {
  id: number
  device_id: string
  timestamp: string
  values: Record<string, number>
  anomaly_flags: Record<string, unknown>
}

export interface AnomaliesListResponse {
  anomalies: Anomaly[]
  total: number
}
