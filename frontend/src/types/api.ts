export interface SystemStatus {
  ok: boolean
  backend_status: string
  database_status: string
  mqtt_broker_status: string
  active_devices: number
  total_devices: number
  uptime_seconds: number
}

export interface HealthCheck {
  status: string
  timestamp: string
}
