import { useQuery } from '@tanstack/react-query'
import { fetchAnomalies } from '@/services/anomalies'
import { POLL_INTERVALS } from '@/utils/constants'

export function useAnomalies() {
  return useQuery({
    queryKey: ['anomalies'],
    queryFn: fetchAnomalies,
    refetchInterval: POLL_INTERVALS.anomalies,
    staleTime: 20_000,
  })
}
