// Cleanup domain (orphan SRTs, old DOBLADO, temps, empty dirs).
// Endpoints (verified against processor-api/api/cleanup.py):
//   GET  /api/cleanup/scan?path=          (sync scan, small dirs)
//   POST /api/cleanup/start?path=         (async → {job_id})
//   GET  /api/cleanup/job/{id}            (poll)
//   POST /api/cleanup/apply               ({paths, dry_run})
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const isActive = (j) => j && ['running', 'pending', 'queued'].includes(String(j.status || '').toLowerCase())

export function useCleanupScan() {
  return useMutation({
    mutationFn: ({ path }) => http.post(`/cleanup/start${qs({ path })}`),
  })
}

export function useCleanupJob(id) {
  return useQuery({
    queryKey: qk.cleanup.job(id),
    queryFn: () => http.get(`/cleanup/job/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (isActive(q.state.data) ? 2_000 : false),
    staleTime: 0,
  })
}

export function useCleanupApply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paths, dryRun = false }) =>
      http.post('/cleanup/apply', { paths, dry_run: dryRun }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cleanup.all })
      qc.invalidateQueries({ queryKey: qk.library.all })
    },
  })
}
