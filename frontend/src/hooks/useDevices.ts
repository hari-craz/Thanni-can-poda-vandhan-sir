import { useQuery } from '@tanstack/react-query'
import { fetchDevices, fetchDevice, fetchCalibrationStatus } from '@/services/devices'
import { POLL_INTERVALS } from '@/utils/constants'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: POLL_INTERVALS.devices,
    staleTime: 10_000,
  })
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => fetchDevice(deviceId),
    enabled: !!deviceId,
    refetchInterval: POLL_INTERVALS.devices,
  })
}

export function useCalibrationStatus(deviceId: string) {
  return useQuery({
    queryKey: ['calibration', deviceId],
    queryFn: () => fetchCalibrationStatus(deviceId),
    enabled: !!deviceId,
  })
}
