// Background jobs domain.
// Endpoints (verified against background_jobs.py + app.py):
//   GET /api/background-jobs           (with optional ?type=)
//   GET /api/background-jobs/{id}
//   GET /api/jobs                      (legacy processing jobs)
//   GET /api/jobs/{id}
//   GET /api/jobs/{id}/events          (SSE)
import { useQuery } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const ACTIVE = new Set(['running', 'pending', 'queued'])
const isActive = (j) => j && ACTIVE.has(String(j.status || '').toLowerCase())

export function useBackgroundJobs(type) {
  return useQuery({
    queryKey: qk.jobs.list(type),
    queryFn: async () => {
      const data = await http.get(`/background-jobs${qs({ type })}`)
      return Array.isArray(data) ? data : data?.jobs || []
    },
    refetchInterval: (q) => {
      const list = q.state.data
      return Array.isArray(list) && list.some(isActive) ? 2_000 : 15_000
    },
    staleTime: 0,
  })
}

export function useJob(id) {
  return useQuery({
    queryKey: qk.jobs.detail(id),
    queryFn: () => http.get(`/background-jobs/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (isActive(q.state.data) ? 2_000 : 30_000),
    staleTime: 0,
  })
}

export function jobEventsUrl(id) {
  return `/api/jobs/${id}/events`
}
