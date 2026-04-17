// System metrics (CPU/RAM/Disk/GPU aggregated from backends).
//   GET /api/metrics/
import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function useMetrics() {
  return useQuery({
    queryKey: qk.metrics.all,
    queryFn: () => http.get('/metrics/'),
    refetchInterval: 5_000,
    staleTime: 0,
  })
}
