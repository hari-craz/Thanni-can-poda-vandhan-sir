import api from './api'
import type { Device, DevicesListResponse, DeviceProvisionRequest, DeviceProvisionResponse, KeyRotationResponse, CalibrationStatus } from '@/types/device'

export async function fetchDevices(): Promise<DevicesListResponse> {
  const { data } = await api.get<DevicesListResponse>('/devices')
  return data
}

export async function fetchDevice(deviceId: string): Promise<Device> {
  const { data } = await api.get<Device>(`/devices/${deviceId}`)
  return data
}

export async function provisionDevice(req: DeviceProvisionRequest): Promise<DeviceProvisionResponse> {
  const { data } = await api.post<DeviceProvisionResponse>('/devices/provision', req)
  return data
}

export async function rotateApiKey(deviceId: string): Promise<KeyRotationResponse> {
  const { data } = await api.post<KeyRotationResponse>(`/devices/${deviceId}/keys/rotate`)
  return data
}

export async function fetchCalibrationStatus(deviceId: string): Promise<CalibrationStatus> {
  const { data } = await api.get<CalibrationStatus>(`/devices/${deviceId}/calibration-status`)
  return data
}

export async function calibrateDevice(deviceId: string, offsets: Record<string, number>): Promise<unknown> {
  const { data } = await api.post(`/devices/${deviceId}/calibrate`, { offsets })
  return data
}
