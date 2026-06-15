export interface SensorReading {
  id: number
  device_id: string
  ph: number
  turbidity: number
  tds: number
  temperature: number
  flow_rate: number
  timestamp: string
  received_at: string
  quality_score: number
  anomaly_flags: Record<string, unknown> | null
}

export interface SensorDataResponse {
  device_id: string
  readings: SensorReading[]
  total: number
}
