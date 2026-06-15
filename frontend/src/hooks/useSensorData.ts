import { useQuery } from '@tanstack/react-query'
import { fetchSensorData } from '@/services/sensorData'
import { POLL_INTERVALS } from '@/utils/constants'

export function useSensorData(deviceId: string, limit = 100) {
  return useQuery({
    queryKey: ['sensorData', deviceId, limit],
    queryFn: () => fetchSensorData(deviceId, limit),
    enabled: !!deviceId,
    refetchInterval: POLL_INTERVALS.sensorData,
    staleTime: 5_000,
  })
}
