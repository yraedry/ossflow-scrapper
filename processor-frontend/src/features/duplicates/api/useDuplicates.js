// Duplicates domain (size+duration, optional md5 deep mode).
//   POST /api/duplicates/start?path=&deep=   → {job_id}
//   GET  /api/duplicates/job/{id}
// Deletion reuses the cleanup/apply endpoint (see useCleanupApply).
import { useMutation, useQuery } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const isActive = (j) => j && ['running', 'pending', 'queued'].includes(String(j.status || '').toLowerCase())

export function useDuplicatesScan() {
  return useMutation({
    mutationFn: ({ path, deep = false }) => http.post(`/duplicates/start${qs({ path, deep })}`),
  })
}

export function useDuplicatesJob(id) {
  return useQuery({
    queryKey: qk.duplicates.job(id),
    queryFn: () => http.get(`/duplicates/job/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (isActive(q.state.data) ? 2_000 : false),
    staleTime: 0,
  })
}
