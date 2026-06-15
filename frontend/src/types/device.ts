export interface Device {
  device_id: string
  name: string
  location: string
  status: 'online' | 'offline'
  last_seen: string
  firmware_version: string | null
  is_active: boolean
  created_at: string
}

export interface DevicesListResponse {
  devices: Device[]
  total: number
}

export interface DeviceProvisionRequest {
  device_id: string
  name: string
  location: string
}

export interface DeviceProvisionResponse {
  device_id: string
  api_key: string
  qr_code: string
  setup_url: string
}

export interface KeyRotationResponse {
  new_key: string
  old_key_revoked_in: number
  old_key_expires_at: string
}

export interface CalibrationStatus {
  device_id: string
  last_calibration_at: string | null
  calibration_due_in_days: number | null
  needs_calibration: boolean
  calibration_overdue: boolean
}

export interface FirmwareInfo {
  device_id: string
  version: string
  url: string
  signature: string | null
  uploaded_at: string
  release_notes: string | null
}
