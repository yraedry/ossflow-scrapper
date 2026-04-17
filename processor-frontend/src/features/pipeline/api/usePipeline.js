// Pipeline domain hooks.
// Endpoints (verified against processor-api/api/pipeline.py):
//   POST   /api/pipeline                     → create pipeline { path, steps, options }
//   GET    /api/pipeline                     → list pipelines
//   GET    /api/pipeline/{id}                → pipeline detail
//   GET    /api/pipeline/{id}/events         → SSE
//   POST   /api/pipeline/{id}/cancel         → cancel
//   POST   /api/pipeline/{id}/retry          → retry (→ new pipeline_id)
//   GET    /api/pipeline/eta                 → median ETA per step
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const ACTIVE = new Set(['running', 'pending', 'queued'])

function isActive(p) {
  if (!p) return false
  const s = (p.status || '').toLowerCase()
  return ACTIVE.has(s)
}

export function usePipelines(filters) {
  return useQuery({
    queryKey: qk.pipelines.list(filters),
    queryFn: async () => {
      const data = await http.get('/pipeline')
      const list = Array.isArray(data) ? data : data?.pipelines || data?.items || []
      if (!filters) return list
      return list.filter((p) => {
        if (filters.status && p.status !== filters.status) return false
        if (filters.path && p.path !== filters.path) return false
        return true
      })
    },
    // Adaptive polling: when any pipeline is active, refetch every 2s.
    refetchInterval: (q) => {
      const list = q.state.data
      if (Array.isArray(list) && list.some(isActive)) return 2_000
      return 30_000
    },
    staleTime: 0,
  })
}

export function usePipeline(id) {
  return useQuery({
    queryKey: qk.pipelines.detail(id),
    queryFn: () => http.get(`/pipeline/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (isActive(q.state.data) ? 2_000 : 30_000),
    staleTime: 0,
  })
}

export function usePipelineEta(args) {
  return useQuery({
    queryKey: qk.pipelines.eta(args),
    queryFn: () => http.get(`/pipeline/eta${qs({
      steps: args?.steps,
      video_duration_sec: args?.videoDurationSec,
      path: args?.path,
    })}`),
    staleTime: 60_000,
  })
}

export function useStartPipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, steps, options }) =>
      http.post('/pipeline', { path, steps, options: options || {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pipelines.all }),
  })
}

export function useCancelPipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => http.post(`/pipeline/${id}/cancel`),
    onMutate: async ({ id }) => {
      const key = qk.pipelines.detail(id)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      if (prev) qc.setQueryData(key, { ...prev, status: 'cancelling', _optimistic: true })
      return { key, prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: qk.pipelines.detail(id) })
      qc.invalidateQueries({ queryKey: qk.pipelines.all })
    },
  })
}

export function useRetryPipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => http.post(`/pipeline/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pipelines.all }),
  })
}

export function pipelineEventsUrl(id) {
  return `/api/pipeline/${id}/events`
}
